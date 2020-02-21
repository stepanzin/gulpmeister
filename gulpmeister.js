const gulp = require('gulp');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const del = require('del');
const gulpWebpack = require('webpack-stream');
const browserSync = require('browser-sync').create();
const { join, basename } = require('path');
const Terser = require('terser-webpack-plugin');
const sass = require('gulp-sass');
const gulpIf = require("gulp-if");
const magicImporter = require('node-sass-magic-importer');
const glob = require ('glob');
const chalk = require ('chalk');
const { writeFile } = require('fs');
const crypto = require('crypto');
const plumber = require('gulp-plumber');
const notify = require('gulp-notify');

// Use dart-sass for compile styles
sass.compiler = require('sass');

function taskMarker(fn, name, description) {
    if (name) fn.displayName = name;
    if (description) fn.description = description;
    return fn
}

function manifestGenerator(destinationPath, enabled) {
    const manifestData = {};
    const buildHash = crypto.createHash('md4').update(crypto.randomBytes(20)).digest('hex').slice(-20);
    return {
        memoize(files, ext, writeHash) {
            const keys = Object.keys(files);
            return rename(path => {
                if (enabled) {
                    keys.forEach(entityName => {
                        if (path.basename.includes(entityName)) {
                            if (writeHash) path.basename += `.${buildHash}`;
                            manifestData[`${entityName}.${ext}`] = path.basename + path.extname;
                        }
                    })
                }
                return path;
            })
        },
        manifest(done) {
            const manifestDest = join(__dirname, destinationPath, 'manifest.json');
            writeFile(manifestDest, JSON.stringify(manifestData, null, 4), done)
        }
    }
}

const TaskBuilder = {
    clean: (dest) => taskMarker(() => del(dest), 'clean', 'Clear output directory'),

    scripts: (entries, dest, scriptDir, webpackConfig, terserConfig, useSourcemaps, useMinify, memoize) => taskMarker(() => {
        const files = Object.values(entries);
        webpackConfig.entry = entries;
        webpackConfig.mode = useMinify ? 'production' : 'development';
        if (useSourcemaps) webpackConfig.devtool = 'cheap-source-map';
        terserConfig.sourceMap = useSourcemaps;
        if (useMinify) webpackConfig.plugins.push(new Terser(terserConfig));
        return gulp.src(files)
            .pipe(plumber({
                errorHandler: notify.onError({
                    message: 'Error: <%= error.message %>',
                })
            }))
            .pipe(gulpWebpack(webpackConfig))
            .pipe(memoize(entries, 'js', true))
            .pipe(gulp.dest(join(dest, scriptDir)));
    }, 'scripts'),

    styles: (entries, dest, styleDir, useSourcemaps, useMinify, memoize) => taskMarker(() => {
        const files = Object.values(entries);
        const reverse = Object.keys(entries).reduce((a, key) => ({ ...a, [entries[key]]: key }), {});
        const nameResolver = path => {
            const oldname = files.find(filename => filename.includes(path.basename));
            const newname = reverse[oldname];
            if (newname) path.basename = newname;
            return path;
        };

        const finaldest = join(dest, styleDir);
        const contextOptions = { useMinify };

        return gulp.src(files)
            .pipe(plumber({
                errorHandler: notify.onError({
                    message: 'Error: <%= error.message %>',
                })
            }))
            .pipe(rename(nameResolver))
            .pipe(gulpIf(useSourcemaps, sourcemaps.init()))
            .pipe(sass({ importer: magicImporter() }).on('error', sass.logError))
            .pipe(postcss(contextOptions))
            .pipe(gulpIf(useSourcemaps, sourcemaps.write('.', { sourceRoot: finaldest })))
            .pipe(memoize(entries, 'css', true))
            .pipe(gulp.dest(finaldest))
    }, 'styles'),

    browserSync: (dest, browsersyncConfig) => taskMarker(() => {
        browserSync.init(browsersyncConfig);
        browserSync.watch(dest + '/**/*.*', browserSync.reload);
    }, 'browsersync'),

    watcher: (srcPath, styleTask, scriptTask) => taskMarker(() => {
        const { join } = require('path').posix;

        gulp.watch(join(srcPath, '/**/*.{scss, sass}'), styleTask);
        gulp.watch(join(srcPath, '/**/*.{js, mjs, es6}'), scriptTask);
    }, 'watcher'),
};

module.exports = class GulpMeister {
    constructor(taskName = 'default') {
        this.taskName = taskName;
        this.sourcePath = null;
        this.destinationPath = null;
        this.styleDir = './';
        this.scriptDir = './';
        this.styleEntries = {};
        this.scriptEntries = {};
        this.browsersyncConfig = null;
        this.webpackConfig = require('./webpack.config.js');
        this.babelConfig = {};
        this.terserConfig = { sourceMap: false };
        this.flags = {
            watch: false,
            minify: false,
            manifest: false,
            sourcemaps: false,
        }
    }

    setSourcePath(path) {
        this.sourcePath = path;
        return this
    }

    setDestinationPath(path) {
        this.destinationPath = path;
        return this
    }

    setScriptDir(dir) {
        this.scriptDir = dir;
        return this
    }

    setStyleDir(dir) {
        this.styleDir = dir;
        return this
    }

    setWebpackConfig(config) {
        this.webpackConfig = config;
        return this
    }

    setBabelConfig(config) {
        this.babelConfig = config;
        return this
    }

    setTerserConfig(config) {
        this.terserConfig = config;
        return this
    }

    setBrowserSyncConfig(config) {
        this.browsersyncConfig = config;
        this.flags.watch = true;
        return this
    }

    addScssEntry(path, name) {
        if (path.includes('*')) {
            if (name) {
                console.warn(
                    '[' + chalk.red('GulpMeister.addScssEntry') + '] ' +
                    chalk.yellow('WARNING') + ': ' + chalk.magenta('[name]') +
                    ' argument will be ignored, because you are specify path as glob pattern' );
            }
            glob.sync(path).forEach(file => this.styleEntries[basename(file, '.scss')] = file);
        } else {
            this.styleEntries[name] = path;
        }
        return this
    }

    addScriptEntry(path, name) {
        this.scriptEntries[name] = path;
        return this
    }

    useMinify() {
        this.flags.minify = true;
        return this
    }

    useWatcher() {
        this.flags.watch = true;
        return this
    }

    writeManifest() {
        this.flags.manifest = true;
        return this
    }

    writeSourcemap() {
        this.flags.sourcemaps = true;
        return this
    }

    optional(condition, truth, falsy) {
        if (condition) truth(this);
        else if (falsy instanceof Function) falsy(this);
        return this
    }

    build() {
        const { memoize, manifest } = manifestGenerator(this.destinationPath, this.flags.manifest);

        const styles = TaskBuilder.styles(
            this.styleEntries,
            this.destinationPath,
            this.styleDir,
            this.flags.sourcemaps,
            this.flags.minify,
            memoize,
        );
        const scripts = TaskBuilder.scripts(
            this.scriptEntries,
            this.destinationPath,
            this.scriptDir,
            this.webpackConfig,
            this.terserConfig,
            this.flags.sourcemaps,
            this.flags.minify,
            memoize,
        );

        // buildTasks - tasks that build assets
        const buildTasks = gulp.parallel(styles, scripts);

        // overseerTasks - tasks that watch for changes (e.g. watcher, browserSync)
        let overseerTasks = [];
        if (this.flags.watch) overseerTasks.push(TaskBuilder.watcher(this.sourcePath, styles, scripts));
        if (this.browsersyncConfig !== null) {
            // TODO: Move hardcoded string to this.browserSyncWatchFolder variable
            overseerTasks.push(TaskBuilder.browserSync('./dist', this.browsersyncConfig));
        }

        // tasksList - list of tasks to be passed as arguments to gulp.series
        let tasksList = [TaskBuilder.clean(this.destinationPath), buildTasks];
        if (overseerTasks.length > 0) tasksList.push(gulp.parallel(...overseerTasks));

        if (this.flags.manifest) tasksList.push(manifest);

        return gulp.task(this.taskName, gulp.series(...tasksList));
    }
};
