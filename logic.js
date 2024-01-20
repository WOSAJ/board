const doodleThreshold = 1
const MODE = {
    DOODLE: 0,
    ERASE: 1,
    MOVE: 2
}
const BUTTONS = {
    DOODLE: document.getElementById("doodle"),
    ERASE: document.getElementById("erase"),
    MOVE: document.getElementById("move")
}

const svg = document.getElementById("canvas")

var boxWidth = 0
var boxHeight = 1000
var zoomMul = 1

var stack = []
var stackOperation = []
var stackIndex = 0
var lastDotX = 0
var lastDotY = 0
var currentPolyline = null

var mode = 0
var lastButton = BUTTONS.DOODLE

var active = false
var initalDotX = 0
var initalDotY = 0

var mousePosX = 0
var mousePosY = 0

var lastLength = -1

window.onresize = setBox
setBox()

document.getElementById("undo").onclick = undoAction
document.getElementById("redo").onclick = redoAction
BUTTONS.DOODLE.onclick = e => {
    lastButton.classList.remove("chosen")
    BUTTONS.DOODLE.classList.add("chosen")
    lastButton = BUTTONS.DOODLE
    mode = MODE.DOODLE
}
BUTTONS.ERASE.onclick = e => {
    lastButton.classList.remove("chosen")
    BUTTONS.ERASE.classList.add("chosen")
    lastButton = BUTTONS.ERASE
    mode = MODE.ERASE
}
BUTTONS.MOVE.onclick = e => {
    lastButton.classList.remove("chosen")
    BUTTONS.MOVE.classList.add("chosen")
    lastButton = BUTTONS.MOVE
    mode = MODE.MOVE
}

//WHEN START

svg.addEventListener("mousedown", chooseStart)
svg.addEventListener("touchstart", e => {
    if(e.touches.length==1) {
        let obj = {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.touches[0].target}
        chooseStart(obj)
    }
})

function chooseStart(e) {
    active = true
    switch (mode) {
        case MODE.DOODLE:
            startDoodle(e)
            break;
        case MODE.MOVE:
            startMove(e)
            break;
    }
}

function startDoodle(e) {
    let arr = svg.getAttribute("viewBox").split(' ')
    initalDotX = parseInt(arr[0])
    initalDotY = parseInt(arr[1])
    let x = getDoodleX(e)+initalDotX
    let y = getDoodleY(e)+initalDotY
    let node = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    node.setAttribute("points", x+","+y+" "+x+","+y+" ")
    node.setAttribute("stroke", "#000000")
    node.setAttribute("stroke-width", "10")
    node.setAttribute("stroke-linecap", "round")
    node.setAttribute("fill", "none")
    svg.appendChild(node)
    currentPolyline = node
    lastDotX = x
    lastDotY = y
}

function startMove(e) {
    lastDotX = getDoodleX(e)
    lastDotY = getDoodleY(e)
    let arr = svg.getAttribute("viewBox").split(' ')
    initalDotX = parseInt(arr[0])
    initalDotY = parseInt(arr[1])
}

//WHEN MOVE

svg.addEventListener("mousemove", chooseProcess)
svg.addEventListener("touchmove", e => {
    e.preventDefault()
    if(e.touches.length==1) {
        let obj = {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.touches[0].target}
        chooseProcess(obj)
    } else if(e.touches.length==2 && mode == MODE.MOVE) {
        sensorZoom(e)
    }
}, false)

function chooseProcess(e) {
    mousePosX = e.clientX
    mousePosY = e.clientY
    switch (mode) {
        case MODE.DOODLE:
            doodleProcess(e)
            break;
        case MODE.ERASE:
            eraceProcess(e)
            break;
        case MODE.MOVE:
            moveProcess(e)
            break;
    }
}

function doodleProcess(e) {
    if(currentPolyline == null) return
    let x = getDoodleX(e)+initalDotX
    let y = getDoodleY(e)+initalDotY
    if(Math.abs(lastDotX-x) < doodleThreshold || Math.abs(lastDotX-x) < doodleThreshold) return
    currentPolyline.setAttribute("points", currentPolyline.getAttribute("points")+x+","+y+" ")
    lastDotX = x
    lastDotY = y
}

function eraceProcess(e) {
    let el = document.elementFromPoint(e.clientX, e.clientY)
    if(el == svg || el.parentNode != svg || !active) return
    svg.removeChild(el)
    pushAction(el, true)
}

function moveProcess(e) {
    if(!active) return
    let x = getDoodleX(e)
    let y = getDoodleY(e)
    let dx = x - lastDotX
    let dy = y - lastDotY
    move(initalDotX - dx, initalDotY - dy)

}

//WHEN END/FAIL

svg.addEventListener("mouseup", e => {
    active = false
    endDoodle(e)
})
svg.addEventListener("touchend", e => {
    active = false
    if(e.touches.length==1) {
        let obj = {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.touches[0].target}
        endDoodle(obj)
    }
})
svg.addEventListener("mouseleave", e => {
    active = false
    endDoodle(e)
})
svg.addEventListener("touchcancel", e => {
    active = false
    if(e.touches.length==1) {
        let obj = {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.touches[0].target}
        endDoodle(obj)
    }
})
function endDoodle(e) {
    if(currentPolyline == null) return
    pushAction(currentPolyline, false)
    currentPolyline = null
}

//ZOOM

function zoom(x) {
    let arr = svg.getAttribute("viewBox").split(' ')
    let moveX = parseInt(arr[0])
    let moveY = parseInt(arr[1])
    let oldWidth = parseInt(arr[2])
    let oldheight = parseInt(arr[3])
    boxHeight*=x
    setBox()
    arr = svg.getAttribute("viewBox").split(' ')
    let width = parseInt(arr[2])
    let height = parseInt(arr[3])
    move(moveX+(oldWidth-width)*getDoodleX({clientX:mousePosX})/width, moveY+(oldheight-height)*getDoodleY({clientY:mousePosY})/height)
}

svg.addEventListener("wheel", e => {
    zoom(zoomMul - e.deltaY/1000)
})

function sensorZoom(e) {
    let x1 = getDoodleX(e.touches[0].clientX)
    let x2 = getDoodleX(e.touches[1].clientX)
    let y1 = getDoodleY(e.touches[0].clientY)
    let y2 = getDoodleY(e.touches[1].clientY)
    if(lastLength < 0 ) {
        lastLength = length(x1, y1, x2, y2)
        return;
    } else {
        let l = length(x1, y1, x2, y2)
        let x = (lastLength-l)/10
        let a = (x1+x2)/2
        let b = (y1+y2)/2
        let arr = svg.getAttribute("viewBox").split(' ')
        let moveX = parseInt(arr[0])
        let moveY = parseInt(arr[1])
        let oldWidth = parseInt(arr[2])
        let oldheight = parseInt(arr[3])
        boxHeight*=x
        setBox()
        arr = svg.getAttribute("viewBox").split(' ')
        let width = parseInt(arr[2])
        let height = parseInt(arr[3])
        move(moveX+(oldWidth-width)*a/width, moveY+(oldheight-height)*b/height)
}
}

//CURSED PART

document.addEventListener("keydown", e => {
    if(e.ctrlKey && e.keyCode == 90) undoAction()
    else if(e.ctrlKey && e.keyCode == 89) redoAction()
}) 

function setBox() {
    let rect = svg.getBoundingClientRect()
    rect.width = visualViewport.width - rect.x*2
    rect.height = visualViewport.height - rect.y*2
    svg.setAttribute("style", "width: "+rect.width+"; height: "+rect.height+";")

    let coof = svg.clientWidth/svg.clientHeight
    boxWidth = boxHeight*coof
    let arr = svg.getAttribute("viewBox").split(' ')
    let x = arr[0]
    let y = arr[1]
    svg.setAttribute("viewBox", x + " " + y + " " + boxWidth + " " + boxHeight)
}

function move(dx, dy) {
    let arr = svg.getAttribute("viewBox").split(' ')
    svg.setAttribute("viewBox", Math.round(dx) + " " + Math.round(dy) + " " + arr[2] + " " + arr[3])
}

function getDoodleX(e) {
    let rect = svg.getBoundingClientRect()
    let x = e.clientX - rect.left
    let width = rect.width
    return x/width*boxWidth
}

function getDoodleY(e) {
    let rect = svg.getBoundingClientRect()
    let y = e.clientY - rect.top
    let height = rect.height
    return y/height*boxHeight
}
function length(x1, y1, x2, y2) {
    return(Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1)))
}

//STACK

function pushAction(element, remove) {
    stack[stackIndex] = element
    stackOperation[stackIndex++] = remove
}

function undoAction() {
    if(stackIndex == 0) return
    let element = stack[--stackIndex]
    let remove = stackOperation[stackIndex]
    if(remove) svg.appendChild(element)
    else svg.removeChild(element)
}

function redoAction() {
    if(stack[stackIndex] == undefined) return
    let element = stack[stackIndex]
    let remove = stackOperation[stackIndex++]
    if(remove) svg.removeChild(element)
    else svg.appendChild(element)
}