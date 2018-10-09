'use strict'

const undertakerForwardReference = require('undertaker-forward-reference')
const pump = require('pump')
const tempy = require('tempy')

function mapComposables(gulp, composables) {
  return composables.map(c => c.compose(gulp))
}

function mapComposablesIfPossible(gulp, composables) {
  return composables.map(c => composeIfPossible(gulp, c))
}

function composeIfPossible(gulp, composable) {
  let type = typeof composable
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
  constructor(...fns) {
    super()
    this.fns = fns
  }

  compose(gulp) {
    return gulp.series(...mapComposablesIfPossible(gulp, this.fns))
  }
}

class gulpComposeParallel extends gulpComposeComposable {
  constructor(...tasks) {
    super()
    this.tasks = tasks
  }

    compose(gulp) {
      return gulp.parallel(...mapComposablesIfPossible(gulp, this.tasks))
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
        gulpSource = gulpSource.pipe(pipe.compose(gulp))
      } else {
        gulpSource = gulpSource.pipe(pipe)
      }
    }
    return gulpSource
  }
}

class gulpComposeDest extends gulpComposeComposable {
  constructor(path, options) {
    super()
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
    if(!fns) {
      fns = options
      options = undefined
    }
    this.options = options
    this.fns = fns
    this.events = {}
  }

  on(eventName, cb) {
    this.events[eventName] = cb
  }

  compose(gulp) {
    let watcher = gulp.watch(this.globs, this.options, this.fns)
    for(let eventName in this.events) {
      watcher.on(eventName, this.events[eventName])
    }
    return watcher
  }
}

class gulpComposePump extends gulpComposeComposable {
  constructor(fns, cb) {
    super()
    this.fns = fns
    this.cb = cb
  }

  compose(gulp) {
    return pump(mapComposablesIfPossible(gulp, this.fns), this.cb)
  }
}

class gulpComposeFunction extends gulpComposeComposable {
  constructor(fn) {
    super()
    this.fn = fn
  }

  compose(gulp) {
    return this.fn instanceof gulpComposeComposable ?
      () => this.fn.compose(gulp) :
      this.fn
  }
}

class gulpComposeTask extends gulpComposeComposable {
  constructor(name, fn) {
    super()
    this.name = name
    this.fn = fn
  }

  compose(gulp) {
    return gulp.task(this.name, composeIfPossible(gulp, this.fn))
  }
}

class gulpCompose {
  constructor(gulp) {
    this.gulp = gulp ? gulp : require('gulp')
    this.gulp.registry(undertakerForwardReference())
    this.tasks = {}
    this.watchers = []
  }

  src(globs, options) {
    return new gulpComposeSrc(globs, options)
  }

  dest(path, options) {
    return new gulpComposeDest(path, options)
  }

  watch(globs, options, fns) {
    let watcher = new gulpComposeWatch(globs, options, fns)
    this.watchers.push(watcher)
    return watcher
  }

  fn(fn) {
    return new gulpComposeFunction(fn)
  }

  pump(fns, cb) {
    return new gulpComposePump(fns, cb)
  }

  series(...fns) {
    return new gulpComposeSeries(...fns)
  }

  parallel(...tasks) {
    return new gulpComposeParallel(...tasks)
  }

  task(name, fn) {
    if(!fn) return this.tasks[name]
    this.tasks[name] = new gulpComposeTask(name, fn)
  }

  compose() {
    mapComposables(this.gulp, Object.values(this.tasks))
    mapComposables(this.gulp, this.watchers)
    return this.gulp
  }
}

module.exports = gulpCompose
