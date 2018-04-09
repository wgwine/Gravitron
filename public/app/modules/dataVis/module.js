
function Particle(t, s, h, i, o) {
    this.mass = t;
    this.x = s;
    this.y = h;
    this.vx = i;
    this.vy = o;
    this.ax = 0;
    this.ay = 0;
    this.new = 0;
    this.collided = false;
    this.radius = Math.log(Math.E + t / 3e3);
}
angular.module('App.dataVis')
    .controller('dataVisGraphCtrl', ['$scope', '$rootScope', '$window', '$http', '$interval', '$timeout'
        ,
        function ($scope, $rootScope, $window, $http, $interval, $timeout) {
            $scope.showControls = true;
            const g_const = .001; //how fast acceleration turns to velocity
            var particleList = [];
            var particleShift = [0, 0];
            var maxMass = 100000000; //black hole mass
            var nodeCount =4000;
            const gpu = new GPU();
            var context;
            var force;
            var color_scale = () => 0;
            var icolor = [];
            for (let j = 0; j < 8; j++) {
                icolor[j] = ((maxMass) / 8) * j
            }
            color_scale = d3.scaleLinear().domain(icolor).range([]);
            color_scale = d3.scaleLinear()
                .domain(d3.ticks(0, maxMass, 10))
                .range(['#3344aa', '#646FFC', '#8D95FF', '#CACDFF', '#FFFFFF', '#FFF568', '#FFA952', '#FF6543']);
            var canvas = document.getElementById("canvas");

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight
            var width = canvas.width;
            var height = canvas.height;
            context = canvas.getContext("2d");


            force = d3.forceSimulation().velocityDecay(0.00001)
                .force("gravity", d3.forceManyBody().strength(function (d) {
                    return .5;
                }))

            var interval = -1;
            interval = window.setInterval(integrate, 25);
            var interval2 = window.setInterval(collide, 25);
            $scope.start = function () {
                if (interval == -1) {
                    interval = window.setInterval(integrate, 25);
                }
            }
            $scope.stop = function () {
                clearInterval(interval);
                interval = -1;
            }




            const cpuCalc = function () {
                var newParts = [];
                for (var e = 0; e < particleList.length; e++) {
                    if (Math.random()>.75){
                    var thisParticle = particleList[e];
                    var xd = width/2 - thisParticle.x;
                    var yd = height/2 - thisParticle.y;
                    var ds = Math.sqrt(xd * xd + yd * yd);
                    // if (ds > 2000) {
                    //     thisParticle.collided = true;

                    // }
                    if (ds < 2000 ) {
                        for (var s = e; s < particleList.length; s++) {
                            var otherParticle = particleList[s];
                            if (thisParticle != otherParticle && !thisParticle.collided && !otherParticle.collided) {
                                var xd = otherParticle.x - thisParticle.x;
                                var yd = otherParticle.y - thisParticle.y;
                                var distance = Math.sqrt(xd * xd + yd * yd);
                                if (distance < thisParticle.radius + otherParticle.radius) {
                                    thisParticle.collided = true;
                                    otherParticle.collided = true;
                                    var l = thisParticle.mass + otherParticle.mass;
                                    var d = new Particle(l,
                                        (thisParticle.x * thisParticle.mass + otherParticle.x * otherParticle.mass) / l,
                                        (thisParticle.y * thisParticle.mass + otherParticle.y * otherParticle.mass) / l,
                                        (thisParticle.vx * thisParticle.mass + otherParticle.vx * otherParticle.mass) / l,
                                        (thisParticle.vy * thisParticle.mass + otherParticle.vy * otherParticle.mass) / l
                                    );
                                    d.new = .1;
                                    newParts.push(d)
                                }
                            }
                        }
                    }else{
                        thisParticle.collided = true;
                    }
                }
                }
                return newParts;
            }
            var integrating = false;

            function collide() {
                if (particleList.length) {
                    var newParticles = [];
                    newParticles = cpuCalc();
                    particleList = particleList.filter((p) => {
                        return !p.collided;
                    }).concat(newParticles);
                    force.nodes(particleList);
                    var c=0;
                    while (particleList.length < nodeCount &&c<1000) {
                        generateItem(1000);
                        c++;
                    }

                }
            }
            function integrate() {

                if (!integrating && particleList.length) {
                    integrating = true;
                    let gpures;

                   
                     force.alphaTarget(.21);
                    // //centerify the largest object when stabilization enabled
                    var largest = null;
                    if ($scope.stabilizer && particleList.length > 0) {
                        largest = particleList[0]
                        for (var m = 0; m < particleList.length; m++) {
                            var pm=particleList[m];
                            if (pm.mass > largest.mass) {
                                largest = pm;
                            }
                            // if (pm.x < 0 || pm.x > width) {
                            //     pm.vx = -1 * pm.vx;
                            // }
                            // if (pm.y < 0 || pm.y > height) {
                            //     pm.vy = -1 * pm.vy;
                            // }

                        }
                        particleShift[0] = (width / 2 - largest.x);
                        particleShift[1] = (height / 2 - largest.y);
                        largest.vx = 0;
                        largest.vy = 0;

                    }
                    //repopulate to make up for deleted objects.
                    //to avoid rebinding the gpu kernel, I am keeping this number constant every cycle(for now)

                    particleShift = [0, 0];
                    integrating = false;
                    
                }
            }

            var firstrun = true;
            $scope.generateProto = function (count) {
                //create the black hole first
                // if (firstrun) {
                //     var particle = new Particle(maxMass, canvas.width / 2, canvas.height / 2, 0, 0);
                //     particleList.push(particle);
                //     firstrun = false;
                // }
                var leng = particleList.length;
                for (var i = 0; i < (count || (nodeCount - leng)); i++) {
                    generateItem();
                }
            }
            $scope.generateProto();


            function generateItem(mass) {
                var rand = Math.random() * 2 * Math.PI;
                var rand2 = Math.random(); // dont create particles dead center
                var rand3 = (mass||100 )* Math.random(); //randomized mass 
                //create them in a circle of radius=width, apply shift to always create around center screen
                var x = ((height) * rand2) * Math.sin(rand);
                var y = ((height) * rand2) * Math.cos(rand);
                var d = Math.sqrt(x * x + y * y);
                //play with velicity calculation to get orbital velocity correct
                //var particle = new Particle(1000 / rand2, width / 2 + x, height / 2 + y, (200000 * y) / (d * d), (-x * 200000) / (d * d));
                //var particle = new Particle(mass|| rand3, width / 2 + x, height / 2 + y, d * y, d * -x);
                var m= rand3;
                var particle = new Particle(m, width / 2 + x, height / 2+y, (2*Math.PI * y)*(.0001 *d), (2*Math.PI * -x)*(.0001 *d));
                //if (mass)
                //particle.new = 1;

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
                    if(e.mass>2000){
                    // don't draw objects that are outside the frame
                    if (e.x > 0 && e.x < width && e.y > 0 && e.y < height) {
                        context.fillStyle = color_scale(e.mass);
                        //make particle a little bigger if it is new
                        var addon = 0;  //changing this scales particles sizes visually

                        if (e.new>0 && !window.showPaths) {
                            addon = e.new/20;
                            context.globalAlpha = .25;
                            context.fillStyle = "#fff";
                            if (e.new > 5){
                                e.new =0;
                                }
                        }
                        addon = e.new;
                        context.beginPath();
                        context.arc(e.x, e.y, e.radius*(addon+1), 0, 2 * Math.PI);
                        context.closePath();

                        //don't waste time on blur unless it is a larger particle
                        if (e.mass >= 1500) {
                            context.shadowColor = color_scale(e.mass);
                            context.shadowBlur = 7;
                        }
                        //make it look like a black hole
                        if (e.mass >= maxMass) {
                            context.globalAlpha = 1;
                            context.shadowBlur = 0;
                            context.fillStyle = "#000";
                            context.shadowColor = '#F5EFF3';//color_scale(e.mass);
                        }
                        
                        context.fill();
                        
                        if (e.new>0 && !window.showPaths) {
                            context.shadowBlur = 5*e.new;   
                            context.fill();
                            context.shadowBlur = 0;
                        }
                        //turn blur off if we turned it on
                        if (e.mass >= 1500) {
                            context.shadowBlur = 0;
                        }
                        // a light outline for the black hole and then reset alpha
                        if (e.mass >= maxMass) {
                            // context.globalAlpha = .3;
                            // context.strokeStyle = "#F4FFFB";
                            // context.stroke();
                            // context.globalAlpha = 1;
                        }
                        //particle will be slightly bigger next time, unless we hit 0 here
                        if (e.new > 0) {
                            e.new += 3;
                        }
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
                particleList.length=1;
            }

            window.tailLength = 0;
            $scope.tails = function () {
                window.tailLength = !window.tailLength ? 3 : 0;
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