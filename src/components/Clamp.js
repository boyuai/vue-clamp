import Vue from 'vue'
import { addListener, removeListener } from 'resize-detector'
import { measure } from './utils'

const raf = require('raf')
let rafId

export default Vue.extend({
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
    lineHeight: Number,
    maxHeight: [String, Number],
    ellipsis: {
      type: String,
      default: '…'
    },
    expanded: Boolean
  },
  data () {
    return {
      offset: 0,
      text: this.getText(),
      nonTextNodes: this.getNonTextNodes(),
      before: null,
      after: null,
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
        // console.log('[watch localExpanded] 恢复默认 offset')
        this.offset = this.contentLength
      } else {
        // console.log('[watch localExpanded] 重新计算 offset')
        this.update()
      }
      if (this.expanded !== val) {
        this.$emit('update:expanded', val)
      }
    },
    isClamped: {
      handler (val) {
        this.$nextTick(() => this.$emit('clampchange', val))
        // console.log('[watch isClamped]: 截断状态变化触发 before & after 更新')
        this.updateBeforeAndAfter()
      },
      immediate: true
    },
    before (val, oldVal) {
      if (val !== oldVal) {
        // console.log('[watch before]: before 变更触发更新')
        this.update()
      }
    },
    after (val, oldVal) {
      if (val !== oldVal) {
        // console.log('[watch after]: after 变更触发更新')
        this.update()
      }
    },
    text (val, oldVal) {
      if (val !== oldVal) {
        // console.log('[watch text]: text 变更触发更新')
        this.localExpanded = false
        this.update()
      }
    },
    nonTextNodes (val, oldVal) {
      if (val.length !== oldVal.length) {
        // console.log('[watch nonTextNodes]: nonTextNodes 变更触发更新')
        this.localExpanded = false
        this.update()
      }
    }
  },
  mounted () {
    // console.log('[mounted] start init')
    this.init()

    this.$watch((vm) => [vm.tag, vm.autoresize].join(), () => {
      // console.log('[mounted] watch start init')
      this.init()
    })
  },
  beforeUpdate () {
    // console.log('[beforeUpdate] start updateBeforeAndAfter')
    this.updateBeforeAndAfter()
    this.text = this.getText()
    this.nonTextNodes = this.getNonTextNodes()
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

      // console.log('[mounted] start updateBeforeAndAfter')
      this.updateBeforeAndAfter()
      this.text = this.getText()
      this.nonTextNodes = this.getNonTextNodes()
      this.localExpanded = !!this.expanded

      this.offset = this.text ? this.text.length : this.nonTextNodes.length
      // console.log('[init] this.offset: ', this.offset)

      this.cleanUp()
      if (this.autoresize) {
        addListener(this.$el, this.resizeOnNextFrame)
        this.unregisterResizeCallback = () => {
          removeListener(this.$el, this.resizeOnNextFrame)
        }
      }

      this.$watch(
        (vm) => [vm.maxLines, vm.lineHeight, vm.maxHeight, vm.ellipsis].join(),
        () => {
          // console.log('[init] watch start update')
          this.update()
        }
      )

      // console.log('[init] start update')
      this.update()
    },
    update () {
      if (this.localExpanded) return

      const { before, text, nonTextNodes, after, ellipsis, maxLines, lineHeight } = this
      const { offset } = measure({
        before,
        text,
        nonTextNodes,
        after,
        ellipsis,
        maxLines,
        lineHeight: text ? undefined : lineHeight,
        originEle: this.$refs.container
      })
      this.offset = offset
    },
    resizeOnNextFrame () {
      // console.log('[resizeOnNextFrame] 开始重排')
      raf.cancel(rafId)
      rafId = raf(() => {
        this.update()
      })
    },
    expand () {
      this.localExpanded = true
    },
    collapse () {
      this.localExpanded = false
    },
    toggle () {
      this.localExpanded = !this.localExpanded
    },
    getText () {
      const [content] = (this.$slots.default || []).filter(
        (node) => !node.tag && !node.isComment
      )
      return content ? content.text : ''
    },
    getNonTextNodes () {
      const nodes = (this.$slots.default || []).filter(
        (node) => node.tag && !node.isComment
      )
      return nodes
    },
    cleanUp () {
      if (rafId) {
        raf.cancel(rafId)
      }
      if (this.unregisterResizeCallback) {
        this.unregisterResizeCallback()
      }
    },
    /**
     * Slots are not responsive, we have to update manually.
     */
    updateBeforeAndAfter () {
      const { expand, collapse, toggle } = this
      const scope = {
        expand,
        collapse,
        toggle,
        clamped: this.isClamped,
        expanded: this.localExpanded
      }

      this.before = this.$scopedSlots.before
        ? this.$scopedSlots.before(scope)
        : this.$slots.before
      this.after = this.$scopedSlots.after
        ? this.$scopedSlots.after(scope)
        : this.$slots.after
      // console.log('[updateBeforeAndAfter] before: ', this.before)
      // console.log('[updateBeforeAndAfter] after: ', this.after)
    }
  },
  render (h) {
    const content = this.text ? this.text : this.nonTextNodes
    const realContent = this.text ? this.realText : this.realNonTextNodes
    const contents = [
      h(
        'span',
        this.$isServer
          ? {}
          : {
            attrs: {
              'aria-label': this.text ? this.text.trim() : ''
            }
          },
        this.$isServer ? content : realContent
      )
    ]
    if (this.before) {
      contents.unshift(...(Array.isArray(this.before) ? this.before : [this.before]))
    }
    if (this.after) {
      contents.push(...(Array.isArray(this.after) ? this.after : [this.after]))
    }

    const lines = [
      h(
        'span',
        {
          style: {
            boxShadow: 'transparent 0 0'
          }
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
        },
        ref: 'container'
      },
      lines
    )
  }
})
