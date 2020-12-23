import { addListener, removeListener } from 'resize-detector'

// 用于存放被 pop 出来的 nonTextNode
const tmpNodes = {}

/**
 * TODO: 这个组件既使用 state 又直接修改 DOM，在纯 text 场景下问题不大，如果传入多个节点就会出问题
 * 需要使用一个纯函数来根据动态变化的 props / slot 算出内容，放进 data 触发更新
 */
export default {
  name: 'vue-clamp',
  props: {
    tag: {
      type: String,
      default: 'div'
    },
    autoresize: {
      type: Boolean,
      default: false
    },
    maxLines: Number,
    lineHeight: Number, // 非文本内容需要指定行高
    maxHeight: [String, Number],
    ellipsis: {
      type: String,
      default: '…'
    },
    expanded: Boolean
  },
  data () {
    return {
      offset: null,
      text: this.getText(),
      nonTextNodes: this.getNonTextNodes(),
      localExpanded: !!this.expanded
    }
  },
  computed: {
    clampedText () {
      return this.text.slice(0, this.offset) + this.ellipsis
    },
    clampedNonTextNodes () {
      return this.nonTextNodes.slice(0, this.offset)
    },
    isClamped () {
      if (!this.text && this.nonTextNodes.length === 0) {
        return false
      }
      return this.offset !== this.contentLength
    },
    realText () {
      return this.isClamped ? this.clampedText : this.text
    },
    realNonTextNodes () {
      return this.isClamped ? this.clampedNonTextNodes : this.nonTextNodes
    },
    realMaxHeight () {
      if (this.localExpanded) {
        return null
      }
      const { maxHeight } = this
      if (!maxHeight) {
        return null
      }
      return typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
    },
    contentLength () {
      const content = this.text ? this.text : this.nonTextNodes
      return content.length
    }
  },
  watch: {
    expanded (val) {
      this.localExpanded = val
    },
    localExpanded (val) {
      if (val) {
        console.log('[watch localExpanded] start clampAt: ', this.contentLength)
        this.clampAt(this.contentLength)
      } else {
        console.log('[watch localExpanded] start update')
        this.update()
      }
      if (this.expanded !== val) {
        this.$emit('update:expanded', val)
      }
    },
    isClamped: {
      handler (val) {
        this.$nextTick(() => this.$emit('clampchange', val))
      },
      immediate: true
    }
  },
  mounted () {
    console.log('[mounted] start init')
    this.init()

    this.cleanUp()
    const _update = () => {
      console.log('[init] 开始重排更新')
      this.update()
    }
    if (this.autoresize) {
      addListener(this.$el, _update)
      this.unregisterResizeCallback = () => {
        removeListener(this.$el, _update)
      }
    }
    this.$watch(
      (vm) => [vm.maxLines, vm.lineHeight, vm.maxHeight, vm.ellipsis, vm.isClamped].join(),
      () => {
        console.log('[mounted] watch start update')
        this.update()
      }
    )
    this.$watch((vm) => [vm.tag, vm.text, vm.nonTextNodes, vm.autoresize].join(), () => {
      console.log('[mounted] watch start init')
      this.init()
    }) // TODO: 支持非文字内容
  },

  updated () {
    console.log('[updated] 开始更新')
    this.applyChange()
    console.log('[updated] 更新结束')
  },
  beforeDestroy () {
    this.cleanUp()
  },
  methods: {
    init () {
      const contents = this.$slots.default
      if (!contents) {
        return
      }

      this.text = this.getText()
      this.nonTextNodes = this.getNonTextNodes()
      this.localExpanded = !!this.expanded
      this.offset = this.text ? this.text.length : this.nonTextNodes.length
      console.log('[init] this.offset: ', this.offset)

      console.log('[init] 初始化更新')
      this.update()
    },
    update () {
      console.log('[update] this.localExpanded: ', this.localExpanded)
      if (this.localExpanded) {
        // console.log('[update] clear tmpNodes')
        // tmpNodes = {}
        return
      }
      console.log('[update] 开始 applyChange')
      this.applyChange()
      console.log('[update] 判断是否需要截断')
      if (this.isOverflow() || this.isClamped) {
        console.log('[update] 开始 search')
        this.search()
        console.log('[update] 完成截断')
      }
    },
    expand () {
      // console.log('[expand] this.localExpanded: ', true)
      this.localExpanded = true
    },
    collapse () {
      // console.log('[collapse] this.localExpanded: ', false)
      this.localExpanded = false
    },
    toggle () {
      // console.log('[toggle] this.localExpanded: ', !this.localExpanded)
      this.localExpanded = !this.localExpanded
    },
    getLines () {
      let lines
      const contentRef = this.$refs.content
      if (this.text) {
        lines = Object.keys(
          Array.prototype.slice.call(contentRef.getClientRects()).reduce(
            (prev, { top, bottom }) => {
              const key = `${top}/${bottom}`
              if (!prev[key]) {
                prev[key] = true
              }
              return prev
            },
            {}
          )
        ).length
      } else {
        lines = Math.ceil(contentRef.getClientRects()[0].height / this.lineHeight)
      }
      console.log('[getLines] lines: ', lines)
      return lines
    },
    isOverflow () {
      if (!this.maxLines && !this.maxHeight) {
        console.log('[isOverflow] !this.maxLines && !this.maxHeight: ', false)
        return false
      }

      if (this.maxLines) {
        if (this.getLines() > this.maxLines) {
          console.log('[isOverflow] this.maxLines:', this.maxLines)
          console.log('[isOverflow] this.getLines() > this.maxLines: ', true)
          return true
        }
      }

      if (this.maxHeight) {
        if (this.$el.scrollHeight > this.$el.offsetHeight) {
          console.log('[isOverflow] this.$el.scrollHeight > this.$el.offsetHeight: ', true)
          return true
        }
      }
      console.log('[isOverflow]: ', false)
      return false
    },
    getText () {
      // Look for the first non-empty text node
      const [content] = (this.$slots.default || []).filter(
        (node) => !node.tag && !node.isComment
      )
      return content ? content.text : ''
    },
    getNonTextNodes () {
      const nodes = (this.$slots.default || []).filter(
        (node) => node.tag
      )
      // console.log('getNonTextNodes: ', nodes)
      return nodes
    },
    moveEdge (steps) {
      this.clampAt(this.offset + steps)
    },
    clampAt (offset) {
      this.offset = offset
      // console.log('[clampAt] this.offset: ', offset)
      console.log('[clampAt] 开始截断')
      this.applyChange()
    },
    applyChange () {
      if (this.text) {
        this.$refs.text.textContent = this.realText
        // console.log('[applyChange] this.$refs.text.textContent: ', this.realText)
        return
      }

      // 挂载新的 DOM
      // TODO: 用 Vue 插入新的节点，直接读取 length
      const nodesRef = this.$refs.nonTextNodes
      let length = nodesRef.childNodes.length
      if (!length) return
      console.log('[applyChange] length: ', length)
      console.log('[applyChange] this.offset: ', this.offset)
      // if (this.offset > this.contentLength || length > this.contentLength) return
      console.log('[applyChange] tmpNodes: ', Object.keys(tmpNodes).length)
      if (length > this.offset) {
        // 处理 length === offset 的情况
        while (length > this.offset) {
          // console.log('[applyChange] nodesRef.lastChild: ', nodesRef.lastChild)
          tmpNodes[length] = nodesRef.lastChild
          nodesRef.lastChild.remove()
          length -= 1
        }
        console.log('[applyChange] tmpNodes 更新: ', Object.keys(tmpNodes).length)
      } else {
        while (length < this.offset) {
          // console.log('[applyChange] appendChild: ', tmpNodes[length + 1])
          nodesRef.appendChild(tmpNodes[length + 1])
          delete tmpNodes[length + 1]
          length += 1
        }
        console.log('[applyChange] tmpNodes 更新: ', Object.keys(tmpNodes).length)
      }
    },
    stepToFit () {
      // console.log('[stepToFit] fill')
      this.fill()
      // console.log('[stepToFit] clamp')
      this.clamp()
    },
    fill () {
      while (
        (!this.isOverflow() || this.getLines() < 2) &&
        this.offset < this.contentLength
      ) {
        // console.log('[fill] moveEdge')
        this.moveEdge(1)
      }
    },
    clamp () {
      while (this.isOverflow() && this.getLines() > 1 && this.offset > 0) {
        // console.log('[clamp] moveEdge')
        this.moveEdge(-1)
      }
    },
    // 通过二分确定不会超高的 offset
    search (...range) {
      const [from = 0, to = this.offset] = range
      console.log('[search] from, to: ', from, to)
      if (to - from <= 3) {
        console.log('[search] start stepToFit')
        this.stepToFit()
        return
      }
      const target = Math.floor((to + from) / 2)
      console.log('[search] start clampAt')
      this.clampAt(target)
      if (this.isOverflow()) {
        console.log('[search] isOverflow start search')
        this.search(from, target)
      } else {
        console.log('[search] not isOverflow start search')
        this.search(target, to)
      }
    },
    cleanUp () {
      if (this.unregisterResizeCallback) {
        this.unregisterResizeCallback()
      }
    }
  },

  render (h) {
    const content = this.text ? this.text : this.nonTextNodes
    const realContent = this.text ? this.realText : this.realNonTextNodes

    const contents = [
      h(
        this.text ? 'span' : 'div',
        this.$isServer
          ? {}
          : {
            ref: this.text ? 'text' : 'nonTextNodes',
            attrs: {
              'aria-label': this.text ? this.text.trim() : ''
            },
            style: {
              display: 'inline'
            }
          },
        this.$isServer ? content : realContent
      )
    ]

    const { expand, collapse, toggle } = this
    const scope = {
      expand,
      collapse,
      toggle,
      clamped: this.isClamped,
      expanded: this.localExpanded
    }
    const before = this.$scopedSlots.before
      ? this.$scopedSlots.before(scope)
      : this.$slots.before
    if (before) {
      contents.unshift(...(Array.isArray(before) ? before : [before]))
    }
    const after = this.$scopedSlots.after
      ? this.$scopedSlots.after(scope)
      : this.$slots.after
    if (after) {
      contents.push(...(Array.isArray(after) ? after : [after]))
    }
    const lines = [
      h(
        this.text ? 'span' : 'div',
        {
          style: {
            boxShadow: 'transparent 0 0'
          },
          ref: 'content'
        },
        contents
      )
    ]
    return h(
      this.tag,
      {
        style: {
          maxHeight: this.realMaxHeight,
          overflow: 'hidden'
        }
      },
      lines
    )
  }
}
