const undertakerForwardReference = require('undertaker-forward-reference');
const pump = require('pump');

function mapComposables(gulp, composables) {
  return composables.map(c => composeIfPossible(gulp, c))
}

function composeIfPossible(gulp, composable) {
  return composable instanceof gulpComposeComposable ? composable.compose(gulp) : composable
}

class gulpComposeComposable {
  constructor() {
  }

  compose (gulp) {
    throw new Error('Not implemented')
  }
}

class gulpComposeSeries extends gulpComposeComposable{
  constructor(...tasks) {
    super()
    this.tasks = tasks
  }

  compose(gulp) {
    return gulp.series(...mapComposables(gulp, this.tasks))
  }
}

class gulpComposeParallel extends gulpComposeComposable {
  constructor(...tasks) {
    super()
    this.tasks = tasks
  }

    compose(gulp) {
      return gulp.parallel(...mapComposables(gulp, this.tasks))
    }
}

class gulpComposeSrc extends gulpComposeComposable {
  constructor(globs, options) {
    super()
    this.globs = globs
    this.options = options ? options : {}
    this.pipes = []
  }

  pipe(fn) {
    this.pipes.push(fn)
    return this
  }

  compose(gulp) {
    let gulpSource = gulp.src(this.globs, this.options)
    for(let pipe of this.pipes) {
      if(pipe instanceof gulpComposeComposable) {
        gulpSource = gulpSource.pipe(pipe.compose())
      } else {
        gulpSource = gulpSource.pipe(pipe)
      }
    }
    return gulpSource
  }
}

class gulpComposeDest extends gulpComposeComposable {
  constructor(path, options) {
    this.path = path
    this.options = options
  }

  compose(gulp) {
    return gulp.dest(this.path, this.options)
  }
}

class gulpComposeWatch extends gulpComposeComposable {
  //TODO: Implement .on stuff
  constructor(globs, options, fns) {
    super()
    this.globs = globs
    if(!fn) {
      fns = options
      options = undefined
    }
    this.options = options
    this.fns = fns
  }

  compose(gulp) {
    return gulp.watch(this.globs, this.options, this.fns)
  }
}

class gulpComposePump extends gulpComposeComposable {
  constructor(fns, cb) {
    super()
    this.fns = fns
    this.cb = cb
  }

  compose(gulp) {
    return pump(mapComposables(gulp, this.fns), this.cb)
  }
}

class gulpCompose {
  constructor(gulp) {
    this.gulp = gulp ? gulp : require('gulp')
    this.gulp.registry(undertakerForwardReference())
    this.tasks = {}
  }

  src(globs, options) {
    return new gulpComposeSrc(globs, options)
  }

  dest(path, options) {
    return new gulpComposeDest(path, options)
  }

  watch(globs, options, fns) {
    return new gulpComposeWatch(globs, options, fns)
  }

  pump(fns, cb) {
    return new gulpComposePump(fns, cb)
  }

  series(...tasks) {
    return new gulpComposeSeries(...tasks)
  }

  parallel(...tasks) {
    return new gulpComposeParallel(...tasks)
  }

  task(name, fn) {
    this.tasks[name] = fn
  }

  compose() {
    for(let task in this.tasks) {
      let fn = composeIfPossible(this.gulp, this.tasks[task])
      this.gulp.task(task, fn)
    }

    return this.gulp
  }
}

module.exports = gulpCompose
