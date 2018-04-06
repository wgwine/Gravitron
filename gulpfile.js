var gulp = require('gulp');
let uglify = require('gulp-uglify-es').default;
var uglifycss = require('gulp-uglifycss');
var concat = require('gulp-concat');
var gulpif = require('gulp-if');
var sass = require('gulp-sass');
var merge = require('merge-stream');
var pump = require('pump');
var watch = require('gulp-watch');
var livereload = require('gulp-livereload');
var doUglify = false;
gulp.task('setProd', function () {
    doUglify = true;
});
function handleError(err) {
    console.log(err.toString());
    this.emit('end');
}
gulp.task('style', function () {
    var sassStream = gulp.src([
        './public/style/site.scss']).pipe(sass())
        .on('error', handleError)

    var cssStream = gulp.src([
    ]);
    return merge(sassStream)
        .pipe(concat('style.min.css'))
        .pipe(gulpif(doUglify, uglifycss()))
        .pipe(gulp.dest('./wwwroot/css'))
        .pipe(livereload());
});

gulp.task('lib', function (cb) {
    pump([
        gulp.src([
            './public/libs/particle.js',
            './public/libs/gpu.js',
            './public/libs/d3.v5.js',
            './node_modules/jquery/dist/jquery.min.js',
            './node_modules/moment/moment.js',
            './node_modules/lodash/lodash.js',
            './node_modules/angular/angular.js',
            './node_modules/angular-route/angular-route.js',
        ]),
        gulpif(doUglify, uglify({ compress: true })),
        concat('lib.min.js'),
        gulp.dest('./wwwroot/js')
    ],
        cb
    );
});
gulp.task('script', function (cb) {
    pump([
        gulp.src([
            './public/app/app.js',
            './public/app/**/*.js']),
        gulpif(doUglify, uglify()),
        concat('script.min.js'),
        gulp.dest('./wwwroot/js')
    ],
        cb
    );
});

gulp.task('assets', function () {
    return gulp.src([
        './public/style/assets/*.+(png|jpg|jpeg|svg|gif|)',
    ])
        .pipe(gulp.dest('./wwwroot/css'));
});
gulp.task('html', function () {
    return gulp.src([
        './public/app/**/*.html'
    ])
        .pipe(gulp.dest('./wwwroot/app'))
        .pipe(livereload());
});
gulp.task('watches', function () {
    gulp.watch('./public/app/**/*.js', ['script']);
    gulp.watch('./public/style/**/*.+(scss|css)', ['style']);
    gulp.watch('./public/style/shared/*.+(css)', ['style']);
    gulp.watch('./public/app/**/*.html', ['html']);
    gulp.watch('./public/libs/*.*', ['script', 'data']);
});
gulp.task('livereload', function () {
    livereload.listen();
});
gulp.task('default', [
    'setProd', 'style', 'lib', 'script', 'html', 'assets'
]);
gulp.task('dev', [
    'style','lib', 'script', 'html', 'assets', 'watches', 'livereload'
]);