import Vue from 'vue'

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const COMMENT_NODE = 8

let ellipsisContainer
let instanceContainer

export function unmountInstance (inst) {
  inst.$destroy()
  ellipsisContainer.removeChild(inst.$el)
  instanceContainer = null
}

export function createInstance ({
  before,
  text,
  nonTextNodes,
  after
}) {
  // debugger
  const content = text || nonTextNodes
  const InstanceClass = Vue.extend({
    render: (createElement) => {
      const contents = [
        createElement(
          'span',
          {},
          content
        )
      ]
      if (before) {
        contents.unshift(...(Array.isArray(before) ? before : [before]))
      }
      if (after) {
        contents.push(...(Array.isArray(after) ? after : [after]))
      }

      return createElement(
        text ? 'span' : 'div',
        {
          domProps: {
            id: 'contents'
          }
        },
        contents
      )
    }
  })

  return new InstanceClass()
}

function getLines ({ node, lineHeight }) {
  // debugger
  let lines
  if (lineHeight) {
    lines = Math.ceil(node.getClientRects()[0].height / lineHeight)
    // console.log(node.getClientRects())
    // console.log('[getLines] lines: ', lines)
    return lines
  }

  lines = Object.keys(
    Array.prototype.slice.call(node.getClientRects()).reduce(
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
  // console.log('[getLines] lines: ', lines)
  return lines
}

function isOverflow ({ node, maxLines, maxHeight, lineHeight }) {
  // debugger
  if (!maxLines && !maxHeight) {
    // console.log('[isOverflow] !maxLines && !maxHeight: ', false)
    return false
  }

  if (maxLines) {
    if (getLines({ node, lineHeight }) > maxLines) {
      // console.log('[isOverflow] maxLines:', maxLines)
      // console.log('[isOverflow] getLines() > maxLines: ', true)
      return true
    }
  }

  if (maxHeight) {
    if (node.offsetHeight > maxHeight) {
      // console.log('[isOverflow] node.scrollHeight > node.offsetHeight: ', true)
      return true
    }
  }
  // console.log('[isOverflow]: ', false)
  return false
}

function styleToString (style) {
  // There are some different behavior between Firefox & Chrome.
  // We have to handle this ourself.
  const styleNames = Array.prototype.slice.apply(style)
  return styleNames.map(name => `${name}: ${style.getPropertyValue(name)};`).join('')
}

function getElementContentHeight (element) {
  const styles = window.getComputedStyle(element)
  const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)

  return element.clientHeight - padding
}

// Get maximum text
function measureText ({
  fullText,
  textNode,
  textHolder,
  maxLines,
  maxHeight,
  startLoc = 0,
  endLoc = fullText.length,
  lastSuccessLoc = 0
}) {
  // debugger
  const midLoc = Math.floor((startLoc + endLoc) / 2)
  const currentText = fullText.slice(0, midLoc)
  textNode.textContent = currentText

  const inRange = () => {
    return !isOverflow({
      node: textHolder,
      maxLines,
      maxHeight
    })
  }

  if (startLoc >= endLoc - 1) {
    // Loop when step is small
    for (let step = endLoc; step >= startLoc; step -= 1) {
      const currentStepText = fullText.slice(0, step)
      textNode.textContent = currentStepText

      if (inRange() || !currentStepText) {
        return step === fullText.length
          ? {
            offset: fullText.length
          }
          : {
            offset: currentStepText.length
          }
      }
    }
  }

  if (inRange()) {
    return measureText({
      textNode,
      fullText,
      textHolder,
      maxLines,
      maxHeight,
      startLoc: midLoc,
      endLoc,
      lastSuccessLoc: midLoc
    })
  }
  return measureText({
    textNode,
    fullText,
    textHolder,
    maxLines,
    maxHeight,
    startLoc,
    endLoc: midLoc,
    lastSuccessLoc
  })
}

export function measureNonTextNodes ({
  nodes,
  nodesHolder,
  beforeNode,
  afterNode,
  maxLines,
  maxHeight,
  lineHeight,
  startLoc = 0,
  endLoc = nodes.length,
  lastSuccessLoc = 0
}) {
  // debugger
  const midLoc = Math.floor((startLoc + endLoc) / 2)
  const currentNodes = nodes.slice(0, midLoc)
  unmountHolder(nodesHolder)
  const [newHolder, appendChildNode] = useHolder({ tag: 'div', beforeNode, afterNode })
  currentNodes.forEach(appendChildNode)
  ellipsisContainer.appendChild(newHolder)

  const inRange = () => {
    return !isOverflow({
      node: newHolder,
      maxLines,
      maxHeight,
      lineHeight
    })
  }

  if (startLoc >= endLoc - 1) {
    for (let step = endLoc; step >= startLoc; step -= 1) {
      const currentStepNode = nodes[step - 1]
      appendChildNode(currentStepNode)

      if (inRange() || !currentStepNode) {
        return step === nodes.length
          ? {
            offset: nodes.length
          }
          : {
            offset: step
          }
      }
    }
  }

  if (inRange()) {
    return measureNonTextNodes({
      nodes,
      nodesHolder: newHolder,
      beforeNode,
      afterNode,
      maxLines,
      maxHeight,
      lineHeight,
      startLoc: midLoc,
      endLoc,
      lastSuccessLoc: midLoc
    })
  }
  return measureNonTextNodes({
    nodes,
    nodesHolder: newHolder,
    beforeNode,
    afterNode,
    maxLines,
    maxHeight,
    lineHeight,
    startLoc,
    endLoc: midLoc,
    lastSuccessLoc
  })
}

/**
 * Create clamped content holder
 */
function useHolder ({
  tag,
  beforeNode,
  ellipsis,
  afterNode
}) {
  const holder = document.createElement(tag)
  let appendHolderChild = function (node) {
    holder.appendChild(node)
  }

  if (beforeNode) {
    holder.appendChild(beforeNode)
  }
  if (ellipsis) {
    const ellipsisTextNode = document.createTextNode(ellipsis)
    holder.appendChild(ellipsisTextNode)
    appendHolderChild = function (node) {
      holder.insertBefore(node, ellipsisTextNode)
    }
  }
  if (afterNode) {
    holder.appendChild(afterNode)
    if (!ellipsis) {
      appendHolderChild = function (node) {
        holder.insertBefore(node, afterNode)
      }
    }
  }

  return [holder, appendHolderChild]
}

export function unmountHolder (holder) {
  ellipsisContainer.removeChild(holder)
}

/**
 * 通过不可见的 DOM 节点来计算高度
 * 1. text - 得益于 span 中的 text 可以自动分行，只需挂载一个节点便可计算 offset
 * 2. nonTextNodes - 反复挂载 & 卸载节点来计算 offset
 * @see https://github.com/ant-design/ant-design/blob/master/components/typography/util.tsx
 */
export function measure ({
  before,
  text,
  nonTextNodes,
  after,
  ellipsis,
  maxLines,
  lineHeight,
  originEle
}) {
  // debugger
  const WONTFIX = {
    offset: text ? text.length : nonTextNodes.length
  }
  if (text && nonTextNodes && nonTextNodes.length) {
    return WONTFIX
  }

  ellipsisContainer = document.createElement('div')
  ellipsisContainer.setAttribute('aria-hidden', 'true')
  instanceContainer = document.createElement('div')
  instanceContainer.id = 'vue-inst'
  ellipsisContainer.appendChild(instanceContainer)
  document.body.appendChild(ellipsisContainer)

  // Set shadow
  const originStyle = window.getComputedStyle(originEle)
  const originCSS = styleToString(originStyle)
  ellipsisContainer.setAttribute('style', originCSS)
  ellipsisContainer.style.position = 'fixed'
  ellipsisContainer.style.left = '0'
  ellipsisContainer.style.height = 'auto'
  ellipsisContainer.style.minHeight = 'auto'
  ellipsisContainer.style.top = '-999999px'
  ellipsisContainer.style.zIndex = '-1000'

  // clean up css overflow
  ellipsisContainer.style.textOverflow = 'clip'
  ellipsisContainer.style.whiteSpace = 'normal'
  ellipsisContainer.style.webkitLineClamp = 'none'

  const inst = createInstance({
    before,
    text,
    nonTextNodes,
    after
  })
  inst.$mount('#vue-inst')

  const maxHeight = originStyle.maxHeight ? getElementContentHeight(ellipsisContainer) : undefined
  const inRange = !isOverflow({
    node: document.getElementById('contents'),
    maxLines,
    maxHeight,
    lineHeight
  })
  // Skip ellipsis if already match
  if (inRange) {
    unmountInstance(inst)
    document.body.removeChild(ellipsisContainer)
    return WONTFIX
  }

  // We should clone the childNode since they're controlled by React and we can't reuse it without warning
  let beforeNode = null
  let childNodes = []
  let afterNode = null
  const children = Array.prototype.slice
    .apply(ellipsisContainer.childNodes[0].childNodes)
    .filter(({ nodeType }) => nodeType !== COMMENT_NODE)
  if (before) {
    beforeNode = children[0].cloneNode(true)
    childNodes = Array.prototype.slice
      .apply(children[1].cloneNode(true).childNodes)
    if (after) {
      afterNode = children[2].cloneNode(true)
    }
  } else {
    childNodes = Array.prototype.slice
      .apply(children[0].cloneNode(true).childNodes)
    if (after) {
      afterNode = children[1].cloneNode(true)
    }
  }
  // console.log('beforeNode: ', beforeNode)
  // console.log('childNodes: ', childNodes)
  // console.log('afterNode: ', afterNode)
  unmountInstance(inst)
  ellipsisContainer.innerHTML = ''

  // ========================= Find match ellipsis content =========================
  const [holder, appendHolderChild] = useHolder({
    tag: text ? 'span' : 'div',
    ellipsis: text ? ellipsis : undefined,
    beforeNode,
    afterNode
  })
  ellipsisContainer.appendChild(holder)

  let offset
  if (text && childNodes[0].nodeType === TEXT_NODE) {
    const fullText = childNodes[0].textContent || ''
    const textNode = document.createTextNode(fullText)
    appendHolderChild(textNode)
    const { offset: newOffset } = measureText({
      fullText,
      textNode,
      textHolder: holder,
      maxLines,
      maxHeight
    })
    if (typeof newOffset === 'number') {
      offset = newOffset
      // console.log('text newOffset: ', newOffset)
    }
  } else if (nonTextNodes.length) {
    const elementNodes = childNodes.filter(element => element.nodeType === ELEMENT_NODE)
    if (!elementNodes.length) {
      return {
        offset: null
      }
    }
    const { offset: newOffset } = measureNonTextNodes({
      nodes: elementNodes,
      nodesHolder: holder,
      beforeNode,
      afterNode,
      maxLines,
      maxHeight,
      lineHeight
    })
    if (typeof newOffset === 'number') {
      offset = newOffset
      // console.log('nonTextNodes newOffset: ', newOffset)
    }
  }

  document.body.removeChild(ellipsisContainer)
  return {
    offset
  }
}
