

angular.module('App.dataVis')
    .controller('dataVisGraphCtrl', ['$scope', '$rootScope', '$window', '$http', '$interval', '$timeout'
        ,
        function ($scope, $rootScope, $window, $http, $interval, $timeout) {
            $scope.showControls = true;
            const g_const = .002; //how fast acceleration turns to velocity
            var particleList = [];
            var particleShift = [0, 0];
            var maxMass = 50000000; //black hole mass
            var nodeCount = 1000;
            const gpu = new GPU();
            var context;

            var color_scale = () => 0;
            var icolor = [];
            for (let j = 0; j < 7; j++) {
                icolor[j] = (100000 / 7) * j
            }
            color_scale = d3.scaleLinear().domain(icolor).range(['#646FFC', '#8D95FF', '#CACDFF', '#FFFFFF', '#FFF568', '#FFA952', '#FF6543']);

            var canvas = document.getElementById("canvas");

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight
            var width = canvas.width;
            var height = canvas.height;
            context = canvas.getContext("2d");
            var interval = -1;
            interval = window.setInterval(integrate, 10);
            $scope.start = function () {
                if (interval == -1) {
                    interval = window.setInterval(integrate, 10);
                }
            }
            $scope.stop = function () {
                clearInterval(interval);
                interval = -1;
            }
            $timeout(function () {
                $scope.generateProto();
            }, 50);
            const cpuCalc = function () {
                var newParts=[];
                for (var e = 0; e < particleList.length; e++) {
                    var thisParticle = particleList[e];


                        for (var s = 0; s < particleList.length; s++) {
                            var otherParticle = particleList[s];
                            if (thisParticle != otherParticle && !thisParticle.collided && !otherParticle.collided) {
                                var xd = otherParticle.x - thisParticle.x;
                                var yd = otherParticle.y - thisParticle.y;

                                var distance = Math.sqrt(xd * xd + yd * yd);

                                var d2 = distance * distance;

                                if (distance * 4 < thisParticle.radius + otherParticle.radius) {
                                    thisParticle.collided = true;
                                    otherParticle.collided = true;
                                    var l = thisParticle.mass + otherParticle.mass;
                                    var d = new Particle(l,
                                        (thisParticle.x * thisParticle.mass + otherParticle.x * otherParticle.mass) / l,
                                        (thisParticle.y * thisParticle.mass + otherParticle.y * otherParticle.mass) / l,
                                        (thisParticle.vx * thisParticle.mass + otherParticle.vx * otherParticle.mass) / l,
                                        (thisParticle.vy * thisParticle.mass + otherParticle.vy * otherParticle.mass) / l
                                    );
                                    d.new = 1;
                                    newParts.push(d)
                                }
                                var p = ((otherParticle.mass) / ((d2)));
                                thisParticle.ax += p * xd / (distance);
                                thisParticle.ay += p * yd / (distance);

                                var p2 = ((thisParticle.mass) / ((d2)));
                                otherParticle.ax -= p2 * xd / (distance);
                                otherParticle.ay -= p2 * yd / (distance);
                            }
                        
                    }
                }
                return newParts;
            }


            function integrate() {
                if (particleList.length) {
                    var newParticles = [];
                    var lengthHold = particleList.length;
                    let gpures;

                    // if (lengthHold > 1) {
                    //     var xs = [];
                    //     var ys = [];
                    //     var ms = [];
                    //     for (var e = 0; e < nodeCount; e++) {
                    //         var p = particleList[e];
                    //         xs.push(p.x);
                    //         ys.push(p.y);
                    //         ms.push(p.mass);
                    //     }
                    //     gpuResult = matMult(xs, ys, ms);
                    // }


                    // //set acceleration on the actual objects
                    // //for detected collisions, create a new child object and mark the parents for deletion
                    // for (var e = 0; e < lengthHold; e++) {
                    //     var thisParticle = particleList[e];
                    //     try {
                    //         thisParticle.ax = gpuResult[0][e];
                    //         thisParticle.ay = gpuResult[1][e];
                    //     } catch (er) {
                    //         console.log(er + ": " + e);
                    //     }
                    //     // layer 3 of gpu result has collision indices
                    //     if (gpuResult[2][e] > -1) {
                    //         var otherParticle = particleList[gpuResult[2][e]];
                    //         thisParticle.collided = true;
                    //         otherParticle.collided = true;
                    //         var l = thisParticle.mass + otherParticle.mass;
                    //         //conserve momentum
                    //         var d = new Particle(l,
                    //             (thisParticle.x * thisParticle.mass + otherParticle.x * otherParticle.mass) / l,
                    //             (thisParticle.y * thisParticle.mass + otherParticle.y * otherParticle.mass) / l,
                    //             (thisParticle.vx * thisParticle.mass + otherParticle.vx * otherParticle.mass) / l,
                    //             (thisParticle.vy * thisParticle.mass + otherParticle.vy * otherParticle.mass) / l
                    //         );
                    //         //visual flash on collide
                    //         d.new = 1;
                    //         newParticles.push(d);
                    //     }
                    // }


                    newParticles = cpuCalc();
                    
                    //destroy particles that stray too far
                    for (var m = 0; m < particleList.length; m++) {
                        var xf = width / 2 - particleList[m].x;
                        var yf = height / 2 - particleList[m].y;
                        particleList[m].collided = particleList[m].collided || Math.sqrt(xf * xf + yf * yf) > height * 2;
                    }
                    particleList = particleList.filter((p) => {
                        return !p.collided;
                    }).concat(newParticles);

                    //centerify the largest object when stabilization enabled
                    var largest = null;
                    if ($scope.stabilizer && particleList.length > 0) {
                        largest = particleList[0]
                        for (var m = 0; m < particleList.length; m++) {
                            if (particleList[m].mass > largest.mass) {
                                largest = particleList[m];
                            }
                        }
                        particleShift[0] = (width / 2 - largest.x);
                        particleShift[1] = (height / 2 - largest.y);
                        largest.vx = 0;
                        largest.vy = 0;
                    }

                    for (var m = 0; m < particleList.length; m++) {
                        //convert acceleration into velocity and velocity into position
                        //offset everything to keep centered
                        var pm = particleList[m];
                        pm.vx += pm.ax * g_const;
                        pm.vy += pm.ay * g_const;
                        pm.x += (pm.vx * g_const) + particleShift[0];
                        pm.y += (pm.vy * g_const) + particleShift[1];
                        pm.ax=0;
                        pm.ay=0;
                        //bounce off walls
                        // if (pm.x < 0 || pm.x > width) {
                        //     pm.vx = -1 * pm.vx;
                        // }
                        // if (pm.y < 0 || pm.y > height) {
                        //     pm.vy = -1 * pm.vy;
                        // }
                    }

                    //repopulate to make up for deleted objects.
                    //to avoid rebinding the gpu kernel, I am keeping this number constant every cycle(for now)
                    while (particleList.length > 0 && particleList.length < nodeCount) {
                        generateItem(1000);
                    }
                    particleShift = [0, 0];
                }
            }

            var firstrun = true;
            $scope.generateProto = function () {
                //create the black hole first
                if (firstrun) {
                    var particle = new Particle(maxMass, width / 2, height / 2, 0, 0);
                    particleList.push(particle);
                    firstrun = false;
                }
                var leng = particleList.length;
                for (var i = 0; i < nodeCount - leng; i++) {
                    generateItem();
                }
                // var particle = new Particle(maxMass / 2, width / 2, height / 2, 0, 0);
                // particleList.push(particle);
                // particle = new Particle(maxMass / 3, (width / 2) -50, height / 2, 0, 0);
                // particleList.push(particle);
            }

            function generateItem(mass) {
                var rand = Math.random() * 2 * Math.PI;
                var rand2 = .05 + Math.random(); // dont create particles dead center
                var rand3 = 10000 * Math.random(); //randomized mass 
                //create them in a circle of radius=width, apply shift to always create around center screen
                var x = ((width) * rand2) * Math.cos(rand) + particleShift[0];
                var y = ((width) * rand2) * Math.sin(rand) + particleShift[1];
                var d = Math.sqrt(x * x + y * y);
                //play with velicity calculation to get orbital velocity correct
                //var particle = new Particle(1000 / rand2, width / 2 + x, height / 2 + y, (200000 * y) / (d * d), (-x * 200000) / (d * d));
                 var particle = new Particle(rand3, width / 2 + x, height / 2 + y, (y * (40000)) / (d * d), (-x * (40000)) / (d * d));
                //var particle = new Particle(mass || rand3, width / 2 + x, height / 2 + y, (y) / (d * (.03)), (-x) / (d * (.03)));
                particleList.push(particle);
            }

            $scope.draw = function () {
                if (!$scope.showPaths)
                    context.clearRect(0, 0, width, height);

                //draw velocity tails
                if (window.tailLength > 0) {
                    context.lineWidth = 1;
                    context.strokeStyle = "blue";
                    context.globalAlpha = .7;
                    context.beginPath();
                    for (var t = 0; t < particleList.length; t++) {
                        var p = particleList[t];
                        context.moveTo(p.x, p.y);
                        context.lineTo(p.x - window.tailLength * p.vx, p.y - window.tailLength * p.vy);
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
                    var e = particleList[t];
                    // don't draw objects that are outside the frame
                    if (e.x > 0 && e.x < width && e.y > 0 && e.y < height) {
                        //make particle a little bigger if it is new
                        var addon = 2;  //changing this scales particles sizes visually
                        if (e.new > 0.1 && !window.showPaths) {
                            addon = e.new * 3;
                        }
                        context.beginPath();
                        context.arc(e.x, e.y, e.radius / (addon), 0, 2 * Math.PI);
                        context.closePath();
                        context.fillStyle = color_scale(e.mass);
                        //don't waste time on blur unless it is a larger particle
                        if (e.mass >= 15000) {
                            context.shadowColor = color_scale(e.mass);
                            context.shadowBlur = 7;
                        }
                        //make it look like a black hole
                        if (e.mass >= maxMass) {
                            context.globalAlpha = 1;
                            context.fillStyle = "#000";
                            context.shadowColor = '#F5EFF3';//color_scale(e.mass);
                        }

                        context.fill();
                        //turn blur off if we turned it on
                        if (e.mass >= 15000) {
                            context.shadowBlur = 0;
                        }
                        // a light outline for the black hole and then reset alpha
                        if (e.mass >= maxMass) {
                            context.globalAlpha = .3;
                            context.strokeStyle = "#F4FFFB";
                            context.stroke();
                            context.globalAlpha = 1;
                        }
                        //particle will be slightly bigger next time, unless we hit 0 here
                        if (e.new > 0) {
                            e.new -= .1;
                        }
                    }
                }
                context.fillStyle = "#aaa";
            }

            $scope.setSize = function (size) {
                document.getElementById("mass").value = size.toExponential(1).replace("+", "");
                setNewMass(size);
            }

            $scope.showPaths = false;
            $scope.togglePaths = function () {
                $scope.showPaths = !$scope.showPaths;
            }

            $scope.stabilizer = true;
            $scope.stablize = function () {
                $scope.stabilizer = !$scope.stabilizer;
            }

            $scope.clearCanvas = function () {
                particleList = [];
            }

            window.tailLength = 0;
            $scope.tails = function () {
                window.tailLength = !window.tailLength ? .01 : 0;
            }

            $scope.makeid = function () {
                var text = "";
                var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

                for (var i = 0; i < 12; i++)
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                return text;
            }
            //stuff to handle draw cycle
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
            (function animloop() {
                requestAnimFrame(animloop);
                $scope.draw();
            })();
        }]);