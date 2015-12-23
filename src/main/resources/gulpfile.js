//
// See https://github.com/tfennelly/jenkins-js-builder
//

// vars
var pluginName = '@pluginName@';
var path = require('path');
var rootDirPrefix = path.resolve('../..') + '/';

console.log('Using rootDirPrefix: ' + rootDirPrefix);

var jsSourceDir = rootDirPrefix + 'src/main/js';
var jsxSourceDir = rootDirPrefix + 'src/main/jsx';
var testSourceDir = rootDirPrefix + 'src/test/js';
var scssSourceDir = rootDirPrefix + 'src/main/scss';
var lessSourceDir = rootDirPrefix + 'src/main/less';
var jsDestDir = rootDirPrefix + 'target/generated-adjuncts';
var destJellyDir = rootDirPrefix + 'target/generated-resources';
var bundleSourceDir = rootDirPrefix +'target/frontend/ui';
var bundleTestDir = rootDirPrefix +'target/frontend/test';
var destClassesDir = rootDirPrefix + 'target/classes'

var jsxSource = [jsxSourceDir + '/_pre.js', jsxSourceDir + '/**/*.jsx', jsxSourceDir + '/_post.js', ];

// gulp
var gulp = require('gulp');
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var changed = require('gulp-changed');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var rename = require('gulp-rename');
var react = require('gulp-react');
var runSequence = require('run-sequence');
var fs = require('fs');

// optimizations:

//test for less
var hasLessDir;
try {
	var stats = fs.lstatSync(lessSourceDir);
	hasLessDir = stats.isDirectory();
}
catch (e) {
    console.log('No LESS dir found.');
    hasLessDir = false;
}

var string_src = function(filename, string) {
	var src = require('stream').Readable({
		objectMode : true
	})
	src._read = function() {
		this.push(new gutil.File({
			cwd : "",
			base : "",
			path : filename,
			contents : new Buffer(string)
		}))
		this.push(null)
	}
	return src
};

gulp.task('create-includes', function() {
	var fs = require('fs');
	var file = jsSourceDir + '/config*.js';

	if (fs.existsSync(file)) {
		return string_src("config.jelly", "THIS IS A JELLY FILE FOR: " + destJellyDir)
			.pipe(gulp.dest(destJellyDir));
	} else {
		console.log('FILE DOES NOT EXIST');
	}
});

//workarounds for needing node_modules in a parent directory somewhere...
//process a copied set of resources
gulp.task('copy-test-sources', function() {
	return gulp.src(testSourceDir + '/**/*.*')
	.pipe(changed(bundleTestDir))
	.pipe(gulp.dest(bundleTestDir));
})

gulp.task('copy-js-sources', function() {
	return gulp.src(jsSourceDir + '/**/*.*')
		.pipe(changed(bundleSourceDir))
		.pipe(gulp.dest(bundleSourceDir));
});

gulp.task('copy-jsx-sources', function() {
	return gulp.src(jsxSource)
		.pipe(sourcemaps.init())
		.pipe(react()) // TODO there's a browserify version, but it makes some errors which you can't understand very easily
		.pipe(concat(pluginName + '.js', {newLine: '\n'}))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest(bundleSourceDir));
});

gulp.task('copy-less-sources', function() {
	if(!hasLessDir) {
		return;
	}
	return gulp.src(lessSourceDir + "/**/*.less")
		.pipe(sourcemaps.init())
		.pipe(concat(pluginName + '.less', {newLine: '\n'}))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest(bundleSourceDir));
});

var builder = require('jenkins-js-builder');

// hack to prevent the build from breaking during watch
var plumber = require('gulp-plumber');
var handleError = function(err) {
  console.log(err.toString());
  this.emit('end');
};

// Need to override the default src locations.
builder.src(bundleSourceDir);

builder.tests('test'); // use relative path ...target/frontend/test
//builder.tests(testSourceDir);

var sass = require('gulp-sass');

// Create the jenkins.js JavaScript bundle.
var bundleSpec = builder.bundle(bundleSourceDir + '/' + pluginName + '.js', pluginName)
    //.withExternalModuleMapping('jquery-detached', 'jquery-detached:jquery2')
    .withExternalModuleMapping('bootstrap-detached', 'bootstrap:bootstrap3', {addDefaultCSS: true})
    //.withExternalModuleMapping('moment', 'momentjs:momentjs2')
    //.withExternalModuleMapping('handlebars', 'handlebars:handlebars3')
    .inDir(jsDestDir)
    .withTransforms([["babelify", {presets: ["es2015", "react"]}]]);

if (hasLessDir) {
    console.log('Using LESS dir: ' + lessSourceDir);
	bundleSpec.less(bundleSourceDir + '/' + pluginName + '.less');
}

// FIXME dir is getting normalized to a relative path and removing parent location references; set it explicitly for now
bundleSpec.bundleInDir = jsDestDir;

gulp.task('local-bundle', function() {
	return runSequence('jsx-lint', 'lint', 'copy-less-sources', 'copy-js-sources', 'copy-jsx-sources', 'bundle');
});

gulp.task('js:watch', function() {
	gulp.watch(jsSourceDir + '/**/*.js', ['local-bundle']);
});

gulp.task('jsx:watch', function() {
	gulp.watch(jsxSourceDir + '/**/*.*', ['local-bundle']);
});

gulp.task('less:watch', function() {
	gulp.watch(lessSourceDir + '/**/*.less', function() {
		return runSequence('copy-less-sources', 'bundle');
	});
});

gulp.task('scss', function(){
	return gulp.src(scssSourceDir + '/**/*.scss')
		.pipe(sourcemaps.init())
		.pipe(sass())
		.pipe(sourcemaps.write())
		.pipe(sass().on('error', sass.logError))
		.pipe(concat(pluginName + '.css'))
		.pipe(gulp.dest(jsDestDir));
});

gulp.task('scss:watch', function() {
	gulp.watch(scssSourceDir + '/**/*.scss', ['scss']);
});

gulp.task('lint', function(){
    return gulp.src(jsSourceDir + '/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task("jsx-lint", function() {
    return gulp.src(jsxSource)
       .pipe(react())
       .pipe(jshint())
       .pipe(jshint.reporter("default", {verbose: true}))
       .pipe(jshint.reporter("fail"));
});

gulp.task('resources:watch', function() {
	gulp.watch(jsDestDir + '/**/*.*', ['copy-to-resources']);
});

gulp.task('copy-to-resources', function() {
	return gulp.src(jsDestDir + '/**/*.*')
	    .pipe(gulp.dest(destClassesDir));
});

// Use the predefined tasks from jenkins-js-builder.
builder.defineTasks(['test', 'bundle']);

// Watch Files For Changes
gulp.task('watch', ['scss:watch', 'less:watch', 'js:watch', 'jsx:watch']);

gulp.task('default', ['scss', 'local-bundle']);

// Use this to run default first and get modules bundled
gulp.task('test-all', ['default', 'copy-test-sources'], function() {
	return runSequence('test');
});
