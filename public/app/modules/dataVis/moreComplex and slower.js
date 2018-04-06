// function Particle(t, s, h, i, o) {
//     this.mass = t,
//         this.x = s,
//         this.y = h,
//         this.px = s,
//         this.py = h,
//         this.vx = i,
//         this.vy = o,
//         this.ax = 0,
//         this.ay = 0,
//         this.new = 0,
//         this.collided = false,
//         this.radius = Math.log(Math.E + t / 1e3)
// }

// angular.module('App.dataVis')
//     .controller('dataVisGraphCtrl', ['$scope', '$rootScope', '$window', '$http', '$interval', '$timeout',
//         'd34Service',
//         function ($scope, $rootScope, $window, $http, $interval, $timeout, d34Service) {
//             $scope.showControls = true;
//             var h = .05;
//             var particleList = new Array;
//             var frametime;
//             var starttime;
//             var width;
//             var height;
//             var newMass = 1e3;
//             var onControlBox = !1;
//             var shiftDown = !1;
//             var particleShift = [0, 0];
//             var maxMass = 50000000;
//             var nodeCount = 200;
//             var gridList = new Array;
//             const gpu = new GPU();
//             var context;

//             var color_scale = () => 0;
//             var icolor = [];
//             for (let j = 0; j < 7; j++) {
//                 icolor[j] = (100000 / 7) * j
//             }
//             color_scale = d3.scaleLinear().domain(icolor).range(['#646FFC', '#8D95FF', '#CACDFF', '#FFFFFF', '#FFF568', '#FFA952', '#FF6543']);
//             var t = document.getElementById("canvas");
//             t.width = window.innerWidth;
//             t.height = window.innerHeight
//             width = t.width;
//             height = t.height;
//             context = t.getContext("2d");
//             interval = window.setInterval(integrate, 10);
//             (function animloop() {
//                 requestAnimFrame(animloop);
//                 draw();
//             })();
//             $timeout(function () {
//                 $scope.generateProto();
//             }, 50);
//             function mouseDownListener(t) {
//                 onControlBox || (shiftDown = t.shiftKey,
//                     startCoords[0] = t.clientX,
//                     startCoords[1] = t.clientY,
//                     endCoords[0] = t.clientX,
//                     endCoords[1] = t.clientY,
//                     window.addEventListener("mousemove", mouseMoveListener, !1),
//                     window.addEventListener("mouseup", mouseUpListener, !1));
//             }
//             var GsingleDimD = gpu.createKernel(function (i) {
//                 return i[this.thread.x] - i[this.thread.y];
//             }).setOutput([nodeCount, nodeCount]);

//             var GbothDimD = gpu.createKernel(function (i, j) {
//                 if (this.thread.z == 0) {
//                     return i[this.thread.x] - i[this.thread.y];
//                 } else {
//                     return j[this.thread.x] - j[this.thread.y];
//                 }
//             }).setOutput([nodeCount, nodeCount, 2]);
//             //thread.z for x or y
//             // [
//             //     [[nodeCount],[nodeCount]...nodecount], //x distances
//             //     [[nodeCount],[nodeCount]...nodecount]  //y distances
//             // ]

//             var Gdistance = gpu.createKernel(function (xy) {
//                 var xd = xy[0][this.thread.x][this.thread.y];
//                 var yd = xy[1][this.thread.x][this.thread.y];
//                 if (this.thread.z == 0) {
//                     return xd;
//                     //xdistance
//                 } else if (this.thread.z == 1) {
//                     return yd;
//                     //ydistance goes here
//                 } else if (this.thread.z == 2) {
//                     return Math.sqrt(xd * xd + yd * yd);
//                 }
//             }).setOutput([nodeCount, nodeCount, 3]);
//             //thread.z for x or y or d
//             // [
//             //     [[nodeCount],[nodeCount]...nodecount], //x distances
//             //     [[nodeCount],[nodeCount]...nodecount], //y distances
//             //     [[nodeCount],[nodeCount]...nodecount]  //h distances
//             // ]


//             var Gaccel = gpu.createKernel(function (c, xyd) {
//                 var xd = xyd[0][this.thread.x][this.thread.y];
//                 var yd = xyd[1][this.thread.x][this.thread.y];

//                 var d = xyd[2][this.thread.x][this.thread.y];
//                 var dSq = d * d;
                
                
//                 if (this.thread.z == 0) {   
                    
//                     var p = c[this.thread.x] / (dSq);
//                     return (p * xd) / (d);

//                 } else if (this.thread.z == 1) {
//                     var p = c[this.thread.y] / (dSq);
//                     return (p * yd) / (d);
//                 }

//                 return 0;

//             }).setOutput([nodeCount, nodeCount, 2]);

//             var Gsum = gpu.createKernel(function (xy) {
//                 var res = 0;
  
//                 for (var e = 0; e < this.constants.size; e++) {
//                     res = xy[this.thread.y][this.thread.y][e];
//                 }
                
  
//                 return res;
//             }, {
//                     constants: { size: nodeCount, e: Math.E }
//                 }).setOutput([nodeCount, 2]);

//             var superKernel = gpu.combineKernels(GsingleDimD, Gdistance, Gaccel, Gsum, function (x, y, m) {


//                 return Gsum(Gaccel(m, Gdistance(GbothDimD(x, y))));
//             });
//             // var superKernel = gpu.combineKernels(GsingleDimD, Gdistance, Gaccel, function (x, y, m) {


//             //     return Gaccel(m, Gdistance(GbothDimD(x, y)));
//             // });

//             const matMult = gpu.createKernel(function (a, b, c) {
//                 var aay = 0;
//                 var x1 = a[this.thread.x];
//                 var y1 = b[this.thread.x];

//                 for (let i = 0; i < this.constants.size; i++) {
//                     if (i != this.thread.x) {
//                         var xd = x1 - a[i];
//                         var yd = y1 - b[i];
//                         var distance = Math.sqrt(xd * xd + yd * yd);
//                         if (distance > 0) {
//                             var p = c[i] / (distance * distance);
//                             if (this.thread.y == 0) {
//                                 aay -= (p * xd) / (distance);
//                             } else if (this.thread.y == 1) {
//                                 aay -= (p * yd) / (distance);
//                             } else if (this.thread.y == 2) {
//                                 var radius = Math.log(this.constants.e + c[this.thread.x] / 1e3);
//                                 var oradius = Math.log(this.constants.e + c[i] / 1e3);
//                                 if (distance * 2 < radius + oradius) {
//                                     return i;
//                                 }
//                             }
//                         }
//                     }
//                 }
//                 return aay;
//             }, {
//                     constants: { size: nodeCount, e: Math.E }
//                 }).setOutput([nodeCount, 3]);
//             let integrating = false;

//             function integrate() {
//                 if (!integrating) {
//                     integrating = true;
//                     var t = new Array;
//                     var lengthHold = particleList.length;
//                     var minmass = Infinity, maxmass = 0;
//                     for (var e = 0; e < lengthHold; e++) {
//                         var p = particleList[e];
//                         if (p.mass > maxmass)
//                             maxmass = p.mass;
//                         if (p.mass < minmass)
//                             minmass = p.mass;
//                         p.ax = 0;
//                         p.ay = 0;
//                     }

//                     let gpures;

//                     if (lengthHold > 1) {
//                         var xs = [];
//                         var ys = [];
//                         var ms = [];
//                         for (var e = 0; e < nodeCount; e++) {
//                             var p = particleList[e];
//                             xs.push(p.x);
//                             ys.push(p.y);
//                             ms.push(p.mass);
//                         }

//                         //gpures = matMult(xs, ys, ms);
//                         gpures = superKernel(xs, ys, ms);

//                     }


//                     for (var e = 0; e < lengthHold; e++) {
//                         var thisParticle = particleList[e];
//                         thisParticle.ax += gpures[0][e];
//                         thisParticle.ay += gpures[1][e];
//                         // if (gpures[2][e] > 0 && thisParticle.mass < maxMass) {

//                         //     try {
//                         //         thisParticle.collided = true;
//                         //         var otherParticle = particleList[gpures[2][e]];
//                         //         otherParticle.collided = true;
//                         //         var l = thisParticle.mass + otherParticle.mass;
//                         //         var d = new Particle(l,
//                         //             (thisParticle.x * thisParticle.mass + otherParticle.x * otherParticle.mass) / l,
//                         //             (thisParticle.y * thisParticle.mass + otherParticle.y * otherParticle.mass) / l,
//                         //             (thisParticle.vx * thisParticle.mass + otherParticle.vx * otherParticle.mass) / l,
//                         //             (thisParticle.vy * thisParticle.mass + otherParticle.vy * otherParticle.mass) / l
//                         //         );
//                         //         d.mass = Math.min(d.mass, maxMass)
//                         //         d.new = 1;
//                         //         thisParticle = null;
//                         //         otherParticle = null;
//                         //         particleList.push(d);
//                         //     } catch (ccs) {
//                         //         // debugger;
//                         //     }

//                         // }
//                         // if (!thisParticle.collided) {
//                         //     var xf = width / 2 - thisParticle.x;
//                         //     var yf = height / 2 - thisParticle.y;
//                         //     thisParticle.collided = Math.sqrt(xf * xf + yf * yf) > width * 2;
//                         // }
//                     }
//                     for (var m = 0; m < particleList.length; m++) {
//                         var xf = width / 2 - particleList[m].x;
//                         var yf = height / 2 - particleList[m].y;
//                         particleList[m].collided = particleList[m].collided || Math.sqrt(xf * xf + yf * yf) > width * 2;
//                         if (particleList[m].collided && particleList.splice(m, 1)) {
//                             m--;
//                         }
//                     }


//                     var largest = null;
//                     if (window.stabilizer && particleList.length > 0) {
//                         largest = particleList[0]
//                         for (var m = 0; m < particleList.length; m++) {
//                             if (particleList[m].mass > largest.mass) {
//                                 largest = particleList[m];
//                             }
//                         }
//                         particleShift[0] = (width / 2 - largest.x);
//                         particleShift[1] = (height / 2 - largest.y);

//                     }
//                     for (var m = 0; m < particleList.length; m++) {
//                         var pm = particleList[m];
//                         pm.vx += pm.ax * h;
//                         pm.vy += pm.ay * h;
//                         pm.x += (pm.vx * h) + particleShift[0];
//                         pm.y += (pm.vy * h) + particleShift[1];
//                         if (pm.collided && particleList.splice(m, 1)) {
//                             m--;
//                         }
//                         // if (pm.x < 0 || pm.x > width) {
//                         //     pm.vx = -1 * pm.vx;
//                         // }
//                         // if (pm.y < 0 || pm.y > height) {
//                         //     pm.vy = -1 * pm.vy;
//                         // }
//                     }

//                     while (particleList.length > 0 && particleList.length < nodeCount) {
//                         generateStar();
//                     }
//                     particleShift = [0, 0];
//                     integrating = false;
//                 }
//             }

//             var firstrun = true;
//             $scope.generateProto = function () {
//                 if (firstrun) {
//                     var particle = new Particle(5000000000, width / 2, height / 2, 0, 0);
//                     particleList.push(particle);
//                     firstrun = false;
//                 }
//                 particle = new Particle(maxMass / 4, (width / 2) , height / 2 + 50, 0, 0);
//                 particleList.push(particle);
//                 var leng = particleList.length;
//                 for (var i = 0; i < nodeCount - leng; i++) {
//                     generateStar();
//                 }

//                 // var particle = new Particle(maxMass / 2, width / 2, height / 2, 0, 0);
//                 // particleList.push(particle);
//                 // particle = new Particle(maxMass / 3, (width / 2) -50, height / 2, 0, 0);
//                 // particleList.push(particle);

//             }

//             function generateStar() {
//                 var rand = Math.random() * 2 * Math.PI;
//                 var rand2 = .05 + Math.random();
//                 var rand3 = 30000 * Math.random();
//                 var x = ((width) * rand2) * Math.cos(rand);
//                 var y = ((width) * rand2) * Math.sin(rand);
//                 var d = Math.sqrt(x * x + y * y);
//                 //var particle = new Particle(1000 / rand2, width / 2 + x, height / 2 + y, (200000 * y) / (d * d), (-x * 200000) / (d * d));
//                 // var particle = new Particle(rand3, width / 2 + x, height / 2 + y, (y * (40000)) / (d * d), (-x * (40000)) / (d * d));
//                 var particle = new Particle(rand3, width / 2 + x, height / 2 + y, (y) / (d * (.3)), (-x) / (d * (.3)));
//                 particleList.push(particle);
//             }

//             function draw() {

//                 if (!window.showPaths)
//                     context.clearRect(0, 0, width, height);

//                 context.strokeStyle = "blue";

//                 context.lineWidth = 1;
//                 var e;

//                 if (window.tailLength > 0) {
//                     context.strokeStyle = "blue";
//                     context.globalAlpha = .7;
//                     context.beginPath();
//                     for (var t = 0; t < particleList.length; t++) {
//                         e = particleList[t];
//                         context.moveTo(e.x, e.y);
//                         context.lineTo(e.x - window.tailLength * e.vx, e.y - window.tailLength * e.vy);
//                     }
//                     context.closePath();
//                     context.stroke();
//                 }

//                 context.globalAlpha = 1;

//                 context.lineWidth = 1;
//                 context.strokeStyle = "#fff";
//                 context.shadowOffsetX = 0;
//                 context.shadowOffsetY = 0;
//                 for (var t = 0; t < particleList.length; t++) {
//                     e = particleList[t];
//                     if (e.x > 0 && e.x < width && e.y > 0 && e.y < height) {

//                         var addon = 1.7;
//                         if (e.new > 0.1 && !window.showPaths) {
//                             addon = e.new * 3;
//                         }
//                         context.beginPath();
//                         context.arc(e.x, e.y, e.radius / (addon), 0, 2 * Math.PI);
//                         context.closePath();
//                         context.fillStyle = color_scale(e.mass);
//                         if (e.mass >= 15000) {
//                             context.shadowColor = color_scale(e.mass);
//                             context.shadowBlur = 7;
//                         }
//                         if (e.mass >= maxMass) {
//                             context.globalAlpha = 1;
//                             context.fillStyle = "#000";
//                             context.shadowColor = '#F5EFF3';//color_scale(e.mass);
//                         }

//                         context.fill();
//                         if (e.mass >= 15000) {
//                             context.shadowBlur = 0;
//                         }
//                         if (e.mass >= maxMass) {
//                             context.globalAlpha = .3;
//                             context.strokeStyle = "#F4FFFB";
//                             context.stroke();
//                             context.globalAlpha = 1;
//                         }
//                         if (e.new > 0) {
//                             e.new -= .1;
//                         }
//                     }
//                 }

//                 context.fillStyle = "#aaa";
//             }

//             window.requestAnimFrame = (function () {
//                 return window.requestAnimationFrame ||
//                     window.webkitRequestAnimationFrame ||
//                     window.mozRequestAnimationFrame ||
//                     window.oRequestAnimationFrame ||
//                     window.msRequestAnimationFrame ||
//                     function (callback) {
//                         window.setTimeout(callback, 1000 / 60);
//                     };
//             })();

//             var interval = -1;
//             $scope.start = function () {
//                 if (interval == -1) {
//                     interval = window.setInterval(integrate, 10);
//                 }
//             }

//             $scope.stop = function () {
//                 clearInterval(interval);
//                 interval = -1;
//             }
//             $scope.setSize = function (size) {
//                 document.getElementById("mass").value = size.toExponential(1).replace("+", "");
//                 setNewMass(size);
//             }
//             window.showPaths = false;
//             function togglePaths() {
//                 window.showPaths = !window.showPaths;
//             }
//             window.stabilizer = true;
//             $scope.stablize = function () {
//                 window.stabilizer = !window.stabilizer;
//             }
//             $scope.clearCanvas = function () {
//                 particleList = [];
//             }
//             window.tailLength = 0;
//             $scope.tails = function () {
//                 window.tailLength = !window.tailLength ? .01 : 0;
//             }

//             var enumerateAssociativeArray = function (aArray) {
//                 var result = [];
//                 for (var key in aArray) {
//                     if (aArray.hasOwnProperty(key))
//                         result.push(aArray[key]);
//                 }
//                 return result;
//             }
//             $scope.makeid = function () {
//                 var text = "";
//                 var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

//                 for (var i = 0; i < 12; i++)
//                     text += possible.charAt(Math.floor(Math.random() * possible.length));
//                 return text;
//             }
//         }]);