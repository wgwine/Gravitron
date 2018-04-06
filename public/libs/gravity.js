var h = .005,
    context,
    particleList = new Array,
    context,
    frametime,
    starttime,
    width,
    height,
    startCoords = [-1, -1],
    endCoords = [-1, -1],
    newMass = 1e3,
    onControlBox = !1,
    shiftDown = !1,
    particleShift = [0, 0];
var nodeCount = 4500;
var gridList = new Array;
const gpu = new GPU();



function Particle(t, s, h, i, o) {
    this.mass = t,
        this.x = s,
        this.y = h,
        this.px = s,
        this.py = h,
        this.vx = i,
        this.vy = o,
        this.ax = 0,
        this.ay = 0,
        this.new = 0;
    this.collided = !1,
        this.color = [],
        this.color[0] = 255,
        this.color[1] = Math.round(256 / (1 + Math.pow(this.mass / 1e5, 1))),
        this.color[2] = Math.round(256 / (1 + Math.pow(this.mass / 1e4, 1))),
        this.color[3] = (16711680 + (this.color[1] << 8) + this.color[2]).toString(16),
        this.radius = Math.log(Math.E + t / 1e3)
}

function init() {
    var t = document.getElementById("canvas");
    var e = document.getElementById("controlbox");
    t.width = window.innerWidth;
    t.height = window.innerHeight
    width = t.width;
    height = t.height;
    var incrsize = 10;
    var incrx = width / incrsize;
    var incry = height / incrsize;
    for (var xx = 0; xx < incrx; xx++) {
        var rowList = [];
        for (var yy = 0; yy < incry; yy++) {
            rowList.push({
                native_x: xx * incrsize,
                native_y: yy * incrsize,
                x: xx * incrsize,
                y: yy * incrsize,
                mass: 20
            });
        }
        gridList.push(rowList);
    }
    context = t.getContext("2d");

    window.addEventListener("mousedown", mouseDownListener, !1);
    e.onmouseover = function () {
        onControlBox = !0
    };
    e.onmouseout = function () {
        onControlBox = !1
    };
    (function animloop() {
        requestAnimFrame(animloop);
        draw();
    })();
    generateProto();
}

function main() {
    starttime = Date.now();
    integrate();
    frametime = Date.now() - starttime;
}
function mouseDownListener(t) {
    onControlBox || (shiftDown = t.shiftKey,
        startCoords[0] = t.clientX,
        startCoords[1] = t.clientY,
        endCoords[0] = t.clientX,
        endCoords[1] = t.clientY,
        window.addEventListener("mousemove", mouseMoveListener, !1),
        window.addEventListener("mouseup", mouseUpListener, !1))
}
function mouseMoveListener(t) {
    endCoords[0] = t.clientX,
        endCoords[1] = t.clientY
}
function mouseUpListener(t) {
    if (window.removeEventListener("mousemove", mouseMoveListener),
        window.removeEventListener("mouseup", mouseUpListener),
        !t.shiftKey && !shiftDown) {
        var e = new Particle(newMass, startCoords[0], startCoords[1], endCoords[0] - startCoords[0], endCoords[1] - startCoords[1])
        particleList.push(e)
    }
    t.shiftKey && shiftDown && (particleShift = [endCoords[0] - startCoords[0], endCoords[1] - startCoords[1]]),
        startCoords = [-1, -1],
        endCoords = [-1, -1]
}
function setNewMass(t) {
    console.log(t),
        newMass = t
}

var color_scale = () => 0;
const matMult = gpu.createKernel(function (a, b, c) {
    var aay = 0;
    var x1 = a[this.thread.x];
    var y1 = b[this.thread.x];

    for (let i = 0; i < this.constants.size; i++) {
        if (i != this.thread.x) {
            var xd = x1 - a[i];
            var yd = y1 - b[i];
            var distance = Math.sqrt(xd * xd + yd * yd);
            if (distance > 0) {
                var p = c[i] / (distance * distance);
                if (this.thread.y == 0) {
                    aay -= (p * xd) / (distance);
                } else if (this.thread.y == 1) {
                    aay -= (p * yd) / (distance);
                } else if (this.thread.y == 2) {
                    var radius = Math.log(this.constants.e + c[this.thread.x] / 1e3);
                    var oradius = Math.log(this.constants.e + c[i] / 1e3);
                    if (distance * 8 < radius + oradius) {
                        return i;
                    }
                }
            }
        }
    }
    return aay;
}, {
        constants: { size: nodeCount, e: Math.E }
    }).setOutput([nodeCount, 3]);
let integrating = false;

function integrate() {
    if (!integrating) {
        integrating = true;
        var t = new Array;
        var lengthHold = particleList.length;
        var minmass = Infinity, maxmass = 0;
        for (var e = 0; e < lengthHold; e++) {
            var p = particleList[e];
            if (p.mass > maxmass)
                maxmass = p.mass;
            if (p.mass < minmass)
                minmass = p.mass;
            p.ax = 0;
            p.ay = 0;
        }

        var icolor = [];
        for (let j = 0; j < 7; j++) {
            icolor[j] = (100000 / 7) * j
        }
        color_scale = d3.scaleLinear().domain(icolor).range(['#646FFC', '#8D95FF', '#CACDFF', '#FFFFFF', '#FFF568', '#FFA952', '#FF6543']);

        let gpures;
        if (lengthHold > 5) {
            var xs = [];
            var ys = [];
            var ms = [];
            for (var e = 0; e < nodeCount; e++) {
                var p = particleList[e];
                xs.push(p.x);
                ys.push(p.y);
                ms.push(p.mass);
            }
            gpures = matMult(xs, ys, ms);
        }

        for (var e = 0; e < lengthHold; e++) {
            var thisParticle = particleList[e];
            thisParticle.ax = 0;
            thisParticle.ay = 0;
            thisParticle.ax += gpures[0][e];
            thisParticle.ay += gpures[1][e];
            if (gpures[2][e] > 0) {
                var otherParticle = particleList[gpures[2][e]];
                thisParticle.collided = true;
                try {
                    otherParticle.collided = true;
                    var l = thisParticle.mass + otherParticle.mass;
                    var d = new Particle(l,
                        (thisParticle.x * thisParticle.mass + otherParticle.x * otherParticle.mass) / l,
                        (thisParticle.y * thisParticle.mass + otherParticle.y * otherParticle.mass) / l,
                        (thisParticle.vx * thisParticle.mass + otherParticle.vx * otherParticle.mass) / l,
                        (thisParticle.vy * thisParticle.mass + otherParticle.vy * otherParticle.mass) / l
                    );
                    d.new = 1;
                    t.push(d);
                } catch (ccs) {
                    // debugger;
                }

            }
            if (!thisParticle.collided) {
                var xf = width / 2 - thisParticle.x;
                var yf = height / 2 - thisParticle.y;
                thisParticle.collided = Math.sqrt(xf * xf + yf * yf) > width * 2;
            }
        }

        particleList = particleList.concat(t);

        var largest = null;
        if (window.stabilizer && particleList.length > 0) {
            largest = particleList[0]
            for (var m = 0; m < particleList.length; m++) {
                if (particleList[m].mass > largest.mass) {
                    largest = particleList[m];
                }
            }
            particleShift[0] = (width / 2 - largest.x);
            particleShift[1] = (height / 2 - largest.y);

        }
        for (var m = 0; m < particleList.length; m++) {
            var pm = particleList[m];
            pm.vx += pm.ax * h;
            pm.vy += pm.ay * h;
            pm.x += (pm.vx * h) + particleShift[0];
            pm.y += (pm.vy * h) + particleShift[1];
            if (pm.collided && particleList.splice(m, 1)) {
                m--;
            }
            // if (pm.x < 0 || pm.x > width) {
            //     pm.vx = -1 * pm.vx;
            // }
            // if (pm.y < 0 || pm.y > height) {
            //     pm.vy = -1 * pm.vy;
            // }
        }
        while (particleList.length > 0 && particleList.length < nodeCount) {
            generateStar();
        }
        particleShift = [0, 0];
        integrating = false;
    }
}

var firstrun = true;
function generateProto() {
    if (firstrun) {
        var particle = new Particle(50000000, width / 2, height / 2, 0, 0);
        particleList.push(particle);
        firstrun = false;
    }
    var leng = particleList.length;
    for (var i = 0; i < nodeCount - leng; i++) {
        generateStar();
    }

}

function generateStar() {
    var rand = Math.random() * 2 * Math.PI;
    var rand2 = .05 + Math.random();
    var rand3 = 1000 * Math.random();
    var x = ((width) * rand2) * Math.cos(rand);
    var y = ((width) * rand2) * Math.sin(rand);
    var d = Math.sqrt(x * x + y * y);
    //var particle = new Particle(1000 / rand2, width / 2 + x, height / 2 + y, (200000 * y) / (d * d), (-x * 200000) / (d * d));
    var particle = new Particle(rand3, width / 2 + x, height / 2 + y, (y * (70000)) / (d *d ), (-x * (70000)) / (d *d));
    //var particle = new Particle(rand3, width / 2 + x, height / 2 + y, (y) / (d * (.02)), (-x) / (d * (.02)));
    particleList.push(particle);
}

function draw() {

    if (!window.showPaths)
        context.clearRect(0, 0, width, height);

    context.strokeStyle = "blue";

    context.beginPath();
    context.moveTo(startCoords[0], startCoords[1]);
    context.lineTo(endCoords[0], endCoords[1]);
    context.closePath();
    context.stroke();
    context.lineWidth = 1;
    var e;

    if (window.tailLength > 0) {
        context.strokeStyle = "blue";
        context.globalAlpha = .7;
        context.beginPath();
        for (var t = 0; t < particleList.length; t++) {
            e = particleList[t];
            context.moveTo(e.x, e.y);
            context.lineTo(e.x - window.tailLength * e.vx, e.y - window.tailLength * e.vy);
        }
        context.closePath();
        context.stroke();
    }

    context.globalAlpha = 1;

    context.lineWidth = 1;
    context.strokeStyle = "#fff";
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    for (var t = 0; t < particleList.length; t++) {
        e = particleList[t];
        if (e.x > 0 && e.x < width && e.y > 0 && e.y < height) {

            var addon = 1.7;
            if (e.new > 0.1 && !window.showPaths) {
                addon = e.new * 3;
            }
            context.beginPath();
            context.arc(e.x, e.y, e.radius / (addon), 0, 2 * Math.PI);
            context.closePath();
            context.fillStyle = color_scale(e.mass);
            if (e.mass >= 15000) {
                context.shadowColor = color_scale(e.mass);
                context.shadowBlur = 7;
            }
            if (e.mass >= 50000000) {
                context.globalAlpha = 1;
                context.fillStyle = "#000";
                context.shadowColor = '#F5EFF3';//color_scale(e.mass);
            }

            context.fill();
            if (e.mass >= 15000) {
                context.shadowBlur = 0;
            }
            if (e.mass >= 50000000) {
                context.globalAlpha = .3;
                context.strokeStyle = "#F4FFFB";
                context.stroke();
                context.globalAlpha = 1;
            }
            if (e.new > 0) {
                e.new -= .1;
            }
        }
    }

    context.fillStyle = "#aaa";
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

var interval = -1;
function start() {
    if (interval == -1) {
        interval = window.setInterval(main, 10);
    }
}

function stop() {
    clearInterval(interval);
    interval = -1;
}
function setSize(size) {
    document.getElementById("mass").value = size.toExponential(1).replace("+", "");
    setNewMass(size);
}
window.showPaths = false;
function togglePaths() {
    window.showPaths = !window.showPaths;
}
window.stabilizer = true;
function stablize() {
    window.stabilizer = !window.stabilizer;
}
function clearCanvas() {
    particleList = [];
}
window.tailLength = 0;
function tails() {
    window.tailLength = !window.tailLength ? .01 : 0;
}
//window.setInterval(gridify, 50);
function gridify() {
    // for (var e = 0; e < gridList.length; e++) {
    //     var rowList = gridList[e];

    //     for (var f = 0; f < rowList.length; f++) {
    //         var holdAx = 0, holdAy = 0;
    //         var thisParticle = rowList[f];
    //         for (var s = 0; s < particleList.length; s++) {
    //             var otherParticle = particleList[s];
    //             var xd = otherParticle.x - thisParticle.x;
    //             var yd = otherParticle.y - thisParticle.y;
    //             var distance = Math.sqrt(xd * xd + yd * yd);

    //             var p = ((otherParticle.mass + thisParticle.mass));
    //             holdAx += p * xd / (distance);
    //             holdAy += p * yd / (distance);
    //         }
    //         thisParticle.ax = holdAx;
    //         thisParticle.ay = holdAy;
    //     }
    // }
    // for (var m = 0; m < gridList.length; m++) {
    //     var rowList = gridList[m];
    //     for (var f = 0; f < rowList.length; f++) {
    //         var pm = rowList[f];
    //         pm.x = pm.native_x + (pm.ax * h) * h;
    //         pm.y = pm.native_y + (pm.ay * h) * h;
    //     }
    // }
}
// function drawGrid() {

//     if (!window.showPaths)
//         context.clearRect(0, 0, width, height);
//     context.strokeStyle = "blue";
//     context.globalAlpha = .77;
//     context.beginPath();
//     for (var t = 0; t < gridList.length-1; t++) {
//         var rowList = gridList[t];
//         for (var f = 0; f < rowList.length-1; f++) {
//             var e = rowList[f];
//             var ex= rowList[f+1];
//             var ey = gridList[t+1][f];
//             context.moveTo(e.x, e.y);
//             context.lineTo(ey.x, ey.y);
//             context.moveTo(e.x, e.y);
//             context.lineTo(ex.x, ex.y);
//         }
//     }
//     context.closePath();
//     context.stroke();
//     context.lineWidth = 1;
//     var e;
//     if (window.tailLength > 0) {
//         // context.strokeStyle =  "green";
//         // for (var t = 0; t < particleList.length; t++) {
//         //     e = particleList[t];
//         //     context.beginPath();
//         //     context.moveTo(e.x, e.y);
//         //     context.lineTo(e.x + window.tailLength *5*window.tailLength*e.ax, e.y + window.tailLength *5*window.tailLength*e.ay);
//         //     context.closePath();
//         //     context.stroke();
//         // }
//     }
// }