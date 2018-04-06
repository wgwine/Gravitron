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
    this.radius = Math.log(Math.E + t / 1e3);
}