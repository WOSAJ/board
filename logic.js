const doodleThreshold = 0.5
const serverURL = "http://localhost:8080"

const MODE = {
    DOODLE: 0,
    ERASE: 1,
    MOVE: 2,
    OTHER: 3
}
const BUTTONS = {
    DOODLE: document.getElementById("doodle"),
    ERASE: document.getElementById("erase"),
    MOVE: document.getElementById("move"),
    OTHER: document.getElementById("other")
}
const pallete = ["#000000", "#FFFFFF", "#ff334d", "#334cff", "#33ff7a", "#ffe933", "#b033ff", "#ff33f8", "#ff5d33", "#660000", "#33fff8"]
const svg = document.getElementById("canvas")
const pickerWindow = document.getElementById("colorPicker")
const picker = document.getElementById("actualPicker")
const palleteButtons = []
for(let i = 0; i < 10; i++) palleteButtons[i] = document.getElementById("pallete"+i)
const sizeWindow = document.getElementById("sizePicker")
const sizeButton = document.getElementById("size")
const sizeButtons = []
for(let i = 0; i < 5; i++) sizeButtons[i] = document.getElementById("size"+i)
const sizes = [1, 5, 15, 25, 50]
const otherWindow = document.getElementById("otherPicker")
const selector = document.getElementById("selecting")

const author = localStorage.getItem("username")
if(author == null) {
    alert(`Please enter your username in "Settings"`)
    window.location.replace("/settings.html")
}

var boxWidth = 0
var boxHeight = 1000
var zoomMul = 1

var stack = []
var stackOperation = []
var stackIndex = 0

var lastDotX = 0
var lastDotY = 0
var currentPolyline = null
var size = 15
var currentSizeButton = sizeButtons[2]

var mode = 0
var lastButton = BUTTONS.DOODLE
var returnTo = null

var active = false
var initalDotX = 0
var initalDotY = 0

var mousePosX = 0
var mousePosY = 0

var lastLength = -1
var past = false

var otherAction = null
var blockMove = false
var endOnOther = false
var endedOnOther = false

var firstPointDone = false
var selectedSet = []
var initalSetX  = []
var initalSetY  = []
var filled = false

window.onresize =  e => {
    setPickerCoords()
    setBox(e)
}
setBox()
setPickerCoords()
{
    let arr = svg.getAttribute("viewBox").split(' ')
    let w = arr[2]
    let h = arr[3]
    move(-w/2, -h/2)
}

for(let i = 0 ; i < palleteButtons.length; i++) {
    let button = palleteButtons[i]
    button.style.background = "fixed"
    button.style.backgroundColor = pallete[i]
    button.onclick = e => picker.value = pallete[i]
}

for(let i = 0 ; i < sizeButtons.length; i++) sizeButtons[i].onclick = e => {
    size = sizes[i]
    currentSizeButton.classList.remove("chosen")
    sizeButtons[i].classList.add("chosen")
    currentSizeButton = sizeButtons[i]
}

function setPickerCoords() {
    let rect = BUTTONS.DOODLE.getBoundingClientRect();
    pickerWindow.style.left = (rect.left)+"px"
    pickerWindow.style.top = (rect.y+rect.height)+"px"
    sizeWindow.style.left = (rect.left)+"px"
    sizeWindow.style.top = (rect.y+rect.height*2)+"px"
    otherWindow.style.left = (rect.left)+"px"
    otherWindow.style.top = (rect.y+rect.height)+"px"
}

//OTHER BUTTONS

sizeButton.onclick = e => {
    sizeWindow.style.display = "block"
}

function setSelected(b) {
    pickerWindow.style.display = "none"
    sizeWindow.style.display = "none"
    otherWindow.style.display = "none"
    lastButton.classList.remove("chosen")
    b.classList.add("chosen")
    lastButton = b
    mode = MODE.OTHER
    blockMove = false
}

document.getElementById("select").onclick = e => {
    setSelected(document.getElementById("select"))
    otherAction = {
        start: e => {
            endOnOther = true
            blockMove = true
            firstPointDone = true
            initalDotX = e.clientX
            initalDotY = e.clientY
            selector.style.display = "block"
            selector.style.left = initalDotX + "px"
            selector.style.top = initalDotY + "px"
            selector.style.width = "0px"
            selector.style.height = "0px"
        },
        process: e => {
            if(!firstPointDone) return
            selector.style.width = Math.abs(e.clientX-initalDotX) + "px"
            selector.style.height = Math.abs(e.clientY-initalDotY) + "px"
            if(e.clientX-initalDotX >= 0) if(e.clientY-initalDotY >= 0) {} else {
                selector.style.top = e.clientY + "px"
            } else if(e.clientY-initalDotY >= 0) {
                selector.style.left = e.clientX + "px"
            } else {
                selector.style.top = e.clientY + "px"
                selector.style.left = e.clientX + "px"
            }
        },
        end: e => {
            endedOnOther = false
            if(!firstPointDone) return
            let rect = selector.getBoundingClientRect()
            blockMove = false
            firstPointDone = false
            selector.style.display = "none"
            selector.style.left = 0
            selector.style.top = 0
            selector.style.width = 0
            selector.style.height = 0
            let x = Math.floor(rect.x)
            let y = Math.floor(rect.y)
            let width = Math.ceil(rect.width)
            let height = Math.ceil(rect.height)
            for(let i = 0; i < width; i++) for(let j = 0; j < height; j++) {
                let element = document.elementFromPoint(i+x, j+y)
                if(!selectedSet.includes(element) && element.parentNode == svg && !element.classList.contains("unedible")) selectedSet.push(element)
            }
            if(selectedSet.length == 0) return
            otherAction = {
                start: e => {
                    initalSetX = []
                    initalSetY = []
                    for(let i = 0; i < selectedSet.length; i++) {
                        let el = selectedSet[i]
                        let trX = 0.0
                        let trY = 0.0
                        if(el.hasAttribute("transform")) {
                            let translate = el.getAttribute("transform").substring(10)
                            translate = translate.substring(0, translate.length-1).split(",")
                            trX = parseFloat(translate[0])
                            trY = parseFloat(translate[1])
                        }
                        initalSetX.push(trX)
                        initalSetY.push(trY)
                    }
                    initalDotX = e.clientX
                    initalDotY = e.clientY
                },
                process: e => {
                    if(active) {
                        for(let i = 0; i < selectedSet.length; i++) {
                            selectedSet[i].setAttribute("transform", "translate("+(initalSetX[i]+getDoodleX({clientX:e.clientX})-getDoodleX({clientX:initalDotX}))+","+(initalSetY[i]+getDoodleY({clientY:e.clientY})-getDoodleY({clientY:initalDotY}))+")")
                        }
                    }
                },
                end: e => {
                    if(endedOnOther) {
                        blockMove = false
                        endedOnOther = false
                        endOnOther = false
                        otherAction = null
                        mode = MODE.MOVE
                        selectedSet = []
                    }
                }
            }
        }
    }
}

document.getElementById("line").onclick = e => {
    setSelected(document.getElementById("line"))
    otherAction = {
        start: e => {
            let arr = svg.getAttribute("viewBox").split(' ')
            initalDotX = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
            initalDotY = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
            let line = document.createElementNS("http://www.w3.org/2000/svg", "line")
            line.setAttribute("id", crypto.randomUUID())
            line.setAttribute("date", new Date().getTime())
            line.setAttribute("x1", initalDotX)
            line.setAttribute("y1", initalDotY)
            line.setAttribute("x2", initalDotX)
            line.setAttribute("y2", initalDotY)
            line.setAttribute("stroke", picker.value)
            line.setAttribute("stroke-width", size)
            line.setAttribute("stroke-linecap", "round")
            svg.appendChild(line)
            currentPolyline = line
        },
        process: e => {
            if(!active) return
            let arr = svg.getAttribute("viewBox").split(' ')
            currentPolyline.setAttribute("x2", getDoodleX({clientX:e.clientX}) + parseInt(arr[0]))
            currentPolyline.setAttribute("y2", getDoodleY({clientY:e.clientY}) + parseInt(arr[1]))
        },
        end: e => {}
    }
}

document.getElementById("circle").onclick = e => {
    setSelected(document.getElementById("circle"))
    filled = false
    otherAction = circleAction
}

document.getElementById("circleS").onclick = e => {
    setSelected(document.getElementById("circleS"))
    filled = true
    otherAction = circleAction
}

const circleAction = {
    start: e => {
        let arr = svg.getAttribute("viewBox").split(' ')
        initalDotX = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        initalDotY = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("id", crypto.randomUUID())
        circle.setAttribute("date", new Date().getTime())
        circle.setAttribute("cx", initalDotX)
        circle.setAttribute("cy", initalDotY)
        circle.setAttribute("r", 0)
        circle.setAttribute("stroke", picker.value)
        circle.setAttribute("stroke-width", size)
        circle.setAttribute("fill", filled ? picker.value : "none")
        svg.appendChild(circle)
        currentPolyline = circle
    },
    process: e => {
        if(!active) return
        let arr = svg.getAttribute("viewBox").split(' ')
        let x = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        let y = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        currentPolyline.setAttribute("r", lengthDots(x, y, initalDotX, initalDotY)/2)
        currentPolyline.setAttribute("cx", (initalDotX+x)/2)
        currentPolyline.setAttribute("cy", (initalDotY+y)/2)
    },
    end: e => {}
}

document.getElementById("rectangle").onclick = e => {
    setSelected(document.getElementById("rectangle"))
    filled = false
    otherAction = rectAction
}

document.getElementById("rectangleS").onclick = e => {
    setSelected(document.getElementById("rectangleS"))
    filled = true
    otherAction = rectAction
}

const rectAction = {
    start: e => {
        let arr = svg.getAttribute("viewBox").split(' ')
        initalDotX = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        initalDotY = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
        rect.setAttribute("id", crypto.randomUUID())
        rect.setAttribute("date", new Date().getTime())
        rect.setAttribute("x", initalDotX)
        rect.setAttribute("y", initalDotY)
        rect.setAttribute("width", 0)
        rect.setAttribute("height", 0)
        rect.setAttribute("stroke", picker.value)
        rect.setAttribute("stroke-width", size)
        rect.setAttribute("stroke-linecap", "round")
        rect.setAttribute("fill", filled ? picker.value : "none")
        svg.appendChild(rect)
        currentPolyline = rect
    },
    process: e => {
        if(!active) return
        let arr = svg.getAttribute("viewBox").split(' ')
        let x = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        let y = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        currentPolyline.setAttribute("width", Math.abs(initalDotX-x))
        currentPolyline.setAttribute("height", Math.abs(initalDotY-y))
        if(x-initalDotX >= 0) if(y-initalDotY >= 0) {} else {
            currentPolyline.setAttribute("y", y)
        } else if(y-initalDotY >= 0) {
            currentPolyline.setAttribute("x", x)
        } else {
            currentPolyline.setAttribute("y", y)
            currentPolyline.setAttribute("x", x)
        }
    },
    end: e => {}
}

document.getElementById("ellipse").onclick = e => {
    setSelected(document.getElementById("ellipse"))
    filled = false
    otherAction = ellipseAction
}

document.getElementById("ellipseS").onclick = e => {
    setSelected(document.getElementById("ellipseS"))
    filled = true
    otherAction = ellipseAction
}

const ellipseAction = {
    start: e => {
        let arr = svg.getAttribute("viewBox").split(' ')
        initalDotX = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        initalDotY = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "ellipse")
        circle.setAttribute("id", crypto.randomUUID())
        circle.setAttribute("date", new Date().getTime())
        circle.setAttribute("cx", initalDotX)
        circle.setAttribute("cy", initalDotY)
        circle.setAttribute("rx", 0)
        circle.setAttribute("ry", 0)
        circle.setAttribute("stroke", picker.value)
        circle.setAttribute("stroke-width", size)
        circle.setAttribute("fill", filled ? picker.value : "none")
        svg.appendChild(circle)
        currentPolyline = circle
    },
    process: e => {
        if(!active) return
        let arr = svg.getAttribute("viewBox").split(' ')
        let x = getDoodleX({clientX:e.clientX}) + parseInt(arr[0])
        let y = getDoodleY({clientY:e.clientY}) + parseInt(arr[1])
        currentPolyline.setAttribute("cx", (initalDotX+x)/2)
        currentPolyline.setAttribute("cy", (initalDotY+y)/2)
        currentPolyline.setAttribute("rx", Math.abs(initalDotX-x)/2)
        currentPolyline.setAttribute("ry", Math.abs(initalDotY-y)/2)
    },
    end: e => {}
}

document.getElementById("fill").onclick = e => {
    setSelected(document.getElementById("fill"))
    filled = true
    otherAction = {
        start: startDoodle,
        process: doodleProcess,
        end: e => {}
    }
} 

document.getElementById("settings").onclick = e => window.location.replace("/settings.html")

//MAIN BUTTONS

document.getElementById("undo").onclick = undoAction
document.getElementById("redo").onclick = redoAction
BUTTONS.DOODLE.onclick = e => {
    filled = false
    endOnOther = false
    otherWindow.style.display = "none"
    if(mode == MODE.DOODLE) {
        pickerWindow.style.display = "block"
        return
    }
    sizeWindow.style.display = "none"
    lastButton.classList.remove("chosen")
    BUTTONS.DOODLE.classList.add("chosen")
    lastButton = BUTTONS.DOODLE
    mode = MODE.DOODLE
    blockMove = false
}
BUTTONS.ERASE.onclick = e => {
    endOnOther = false
    pickerWindow.style.display = "none"
    sizeWindow.style.display = "none"
    otherWindow.style.display = "none"
    lastButton.classList.remove("chosen")
    BUTTONS.ERASE.classList.add("chosen")
    lastButton = BUTTONS.ERASE
    mode = MODE.ERASE
    blockMove = false
}
BUTTONS.MOVE.onclick = e => {
    endOnOther = false
    pickerWindow.style.display = "none"
    sizeWindow.style.display = "none"
    otherWindow.style.display = "none"
    lastButton.classList.remove("chosen")
    BUTTONS.MOVE.classList.add("chosen")
    lastButton = BUTTONS.MOVE
    mode = MODE.MOVE
    blockMove = false
}
BUTTONS.OTHER.onclick = e => {
    if(endOnOther && otherAction != null) {
        otherAction.end(e)
        endedOnOther = true
        return
    }
    pickerWindow.style.display = "none"
    sizeWindow.style.display = "none"
    otherWindow.style.display = "block"
}

//WHEN START

svg.addEventListener("mousedown", e => {
    if(e.shiftKey || e.which == 3) {
        returnTo = mode
        mode = MODE.MOVE
    }
    chooseStart(e)
})
svg.addEventListener("touchstart", e => {
    if(e.touches.length==1) {
        let obj = {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.touches[0].target}
        chooseStart(obj)
    }
})

function chooseStart(e) {
    active = true
    pickerWindow.style.display = "none"
    sizeWindow.style.display = "none"
    otherWindow.style.display = "none"
    switch (mode) {
        case MODE.DOODLE:
            startDoodle(e)
            break;
        case MODE.MOVE:
            startMove(e)
            break;
        case MODE.OTHER:
            if(otherAction != null) otherAction.start(e)
    }
}

function startDoodle(e) {
    let arr = svg.getAttribute("viewBox").split(' ')
    initalDotX = parseInt(arr[0])
    initalDotY = parseInt(arr[1])
    let x = getDoodleX(e)+initalDotX
    let y = getDoodleY(e)+initalDotY
    let node = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    node.setAttribute("id", crypto.randomUUID())
    node.setAttribute("date", new Date().getTime())
    node.setAttribute("points", x+","+y+" "+x+","+y+" ")
    node.setAttribute("stroke", picker.value)
    node.setAttribute("stroke-width", size)
    node.setAttribute("stroke-linecap", "round")
    node.setAttribute("fill", filled ? picker.value : "none")
    svg.appendChild(node)
    currentPolyline = node
    lastDotX = x
    lastDotY = y
    if(past) {
        past = false
        for(let i = stackIndex; stack[i] != undefined; i++) {
            stack[i] = undefined
        }
    }
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
        case MODE.OTHER:
            if(otherAction != null) otherAction.process(e)
    }
}

function doodleProcess(e) {
    if(currentPolyline == null) return
    let x = Math.round((getDoodleX(e)+initalDotX+Number.EPSILON)*1000)/1000
    let y = Math.round((getDoodleY(e)+initalDotY+Number.EPSILON)*1000)/1000
    if(lengthDots(lastDotX, lastDotY, x, y) < doodleThreshold) return
    currentPolyline.setAttribute("points", currentPolyline.getAttribute("points")+x+","+y+" ")
    lastDotX = x
    lastDotY = y
}

function eraceProcess(e) {
    let el = document.elementFromPoint(e.clientX, e.clientY)
    if(el == svg || el.parentNode != svg || !active || el.classList.contains("unedible")) return
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

svg.addEventListener("mouseup", endDoodle)
svg.addEventListener("touchend", e => {
        endDoodle(null)
})
svg.addEventListener("mouseleave", endDoodle)
svg.addEventListener("touchcancel", e => {
    endDoodle(null)
})
function endDoodle(e) {
    lastLength = -1
    active = false
    if(mode == MODE.OTHER && otherAction != null) otherAction.end(e)
    if(currentPolyline != null) {
        pushAction(currentPolyline, false)
        currentPolyline = null
    }
    if(returnTo != null) {
        mode = returnTo
        returnTo = null
    }
}

//ZOOM

function zoom(x) {
    if(blockMove) return
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
    if(blockMove) return
    let x1 = getDoodleX({clientX:e.touches[0].clientX})
    let x2 = getDoodleX({clientX:e.touches[1].clientX})
    let y1 = getDoodleY({clientY:e.touches[0].clientY})
    let y2 = getDoodleY({clientY:e.touches[1].clientY})
    if(lastLength < 0 ) {
        lastLength = lengthDots(x1, y1, x2, y2)
        return;
    } else {
        let l = lengthDots(x1, y1, x2, y2)
        if(Math.abs(lastLength-l)<50) return
        let x = (1+Math.sign(lastLength-l)/20)
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

{
    let req = new XMLHttpRequest()
    req.onload = () => {
        console.log("responded")
        if(req.status != 200) {
            console.log("Load error: " + req.status)
            return
        }
        let list = JSON.parse(req.responseText)
        list.sort((a, b) => a.date-b.date)
        list.forEach(el => {
            svg.innerHTML += el.data
            let node = document.getElementById(el.id)
            node.classList.remove("unedible")
            if(el.author != author) node.classList.add("unedible")
        })
    }
    req.open("GET", serverURL+"/access")
    req.send("get")
    console.log('requested')
}

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
    if(blockMove) return
    if(dx == Infinity || dx != dx || dy == Infinity || dy != dy) return
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
function lengthDots(x1, y1, x2, y2) {
    return(Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1)))
}

//STACK

function pushAction(element, remove) {
    stack[stackIndex] = element
    stackOperation[stackIndex++] = remove
    if(!remove) saveStroke(element)
    else removeStroke(element)
}

function undoAction() {
    if(stackIndex == 0 || blockMove) return
    past = true
    let element = stack[--stackIndex]
    let remove = stackOperation[stackIndex]
    if(remove) svg.appendChild(element)
    else svg.removeChild(element)
}

function redoAction() {
    if(blockMove) return
    if(stack[stackIndex] == undefined) {
        past = false
        return
    }
    let element = stack[stackIndex]
    let remove = stackOperation[stackIndex++]
    if(remove) svg.removeChild(element)
    else svg.appendChild(element)
}

//NET

function saveStroke(element) {
    let req = new XMLHttpRequest()
    req.onload = () => {
        if(req.status != 200) console.error("Save error: " + req.status)
    }
    req.open("POST", serverURL+"/access")
    req.setRequestHeader("Content-Type", "application/json")
    let obj = {
        author: author,
        id: element.id,
        data: element.outerHTML,
        date: element.getAttribute("date")
    }
    req.send(JSON.stringify(obj))
}

function removeStroke(element) {
    let req = new XMLHttpRequest()
    req.onload = () => {
        if(req.status != 200) console.error("Delete error: " + req.status)
    }
    req.open("DELETE", serverURL+"/access")
    req.setRequestHeader("Content-Type", "application/json")
    req.send(JSON.stringify(element.id))
}