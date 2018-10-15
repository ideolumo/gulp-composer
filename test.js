'use strict'

const gulpCompose = require('./index')
const tape = require('tape')
const tempy = require('tempy')
const path = require('path')
const fs = require('fs')

tape('should compose an series task', t => {
  let gc = new gulpCompose()
  let taskName = 'test'
  let task1Called = false
  let task2Called = false
  let tasks = [
    done => {
      task1Called = true
      done()
    },
    done => {
      task2Called = true
      done()
    }
  ]

  gc.task(taskName, gc.series(...tasks))
  t.ok(gc.tasks['test'], 'test task should exists')
  let gulp = gc.compose()
  console.log(gulp._registry._tasks)
  t.ok(gulp._registry._tasks.test.unwrap().displayName == '<series>', 'unwrapped task should be an series task')
  gulp.task('test')(done => {
    t.ok(task1Called, 'task1 got called')
    t.ok(task2Called, 'task2 got called')
    t.end()
  })
})

tape('should compose an parallel task', t => {
  let gc = new gulpCompose()
  let taskName = 'test'
  let task1Called = false
  let task2Called = false
  let tasks = [
    done => {
      task1Called = true
      done()
    },
    done => {
      task2Called = true
      done()
    }
  ]

  gc.task(taskName, gc.parallel(...tasks))
  t.ok(gc.tasks['test'], 'test task should exists')
  let gulp = gc.compose()
  t.ok(gulp._registry._tasks.test.unwrap().displayName == '<parallel>', 'unwrapped task should be an parallel task')
  gulp.task('test')(done => {
    t.ok(task1Called, 'task1 got called')
    t.ok(task2Called, 'task2 got called')
    t.end()
  })
})

tape('should compose a series task which includes another parallel task', t => {
  let gc = new gulpCompose()
  let taskName = 'test'
  let task1Called = false
  let task2Called = false
  let tasks = [
    done => {
      task1Called = true
      done()
    },
    done => {
      task2Called = true
      done()
    }
  ]

  let task3Called = false
  let tasks2 = [
    done => {
      task3Called = true
      done()
    },
    'test'
  ]
  gc.task(taskName, gc.parallel(...tasks))
  gc.task('test2', gc.series(...tasks2))

  let gulp = gc.compose()

  gulp.task('test2')(done => {
    t.ok(task1Called, 'task1 got called')
    t.ok(task2Called, 'task2 got called')
    t.ok(task2Called, 'task3 got called')

    t.end()
  })
})

tape('gulpCompose.src should return a gulpComposeSrc instance', t => {
  let gc = new gulpCompose()

  let task1Called = false
  let task1Fn = done => {
    task1Called = true
    done()
  }

  let task2Called = false
  let task2Fn = done => {
    task2Called = true
    done()
  }

  let globs = ['./test/**.js', '!./test/**.jsx']
  let gcSrc = gc.src(globs).pipe(task1Fn).pipe(task2Fn)
  t.ok(gcSrc.globs == globs, 'globs should be the same')
  t.ok(Object.keys(gcSrc.options).length === 0 && gcSrc.options.constructor === Object, 'options should be empty object')
  t.deepLooseEqual(gcSrc.pipes, [task1Fn, task2Fn], 'should contain piped tasks in same order')

  let options = {foo:'bar'}
  gcSrc = gc.src(globs, options).pipe(task1Fn).pipe(task2Fn)
  t.ok(gcSrc.globs == globs, 'globs should be the same')
  t.equals(gcSrc.options, options, 'options should be the same')
  t.end()
})

tape('gulpCompose.compose should compose more complex tasks', t => {
  let gc = new gulpCompose()

  let task1Called = false
  let task1Fn = done => {
    task1Called = true
    done()
  }

  let task2Called = false
  let task2Fn = done => {
    task2Called = true
    done()
  }


  let task3Called = false
  let task3Fn = done => {
    task3Called = true
    done()
  }

  gc.task('test', gc.series(gc.parallel(task1Fn, task2Fn), gc.series(task3Fn)))
  let gulp = gc.compose()
  gulp.task('test')(done => {
    t.ok(task1Called, 'task1 got called')
    t.ok(task2Called, 'task2 got called')
    t.ok(task2Called, 'task3 got called')

    t.end()
  })
})

tape.skip('gulpCompose.pump should wrap a pump', t => {
  let gc = new gulpCompose()

  let task1Called = false
  let task1Fn = done => {
    task1Called = true
    done()
  }

  let task2Called = false
  let task2Fn = done => {
    task2Called = true
    done()
  }

  gc.task('test', gc.series(gc.pump([task1Fn, task2Fn], (err) => console.log(err))))
  let gulp = gc.compose()
  gulp.task('test')(done => {
    t.ok(task1Called, 'task1 got called')
    t.ok(task2Called, 'task2 got called')

    t.end()
  })
})

tape('gulpCompose.dest() should wrap a gulp.dest()', t => {
  let gc = new gulpCompose()

  let dest = gc.dest('./build')
  t.end()
})

tape('.fn() should wrap a function', t => {
  let gc = new gulpCompose()

  let fnGotCalled = false

  gc.task('test', gc.fn(() => {
    fnGotCalled = true
  }))

  let gulp = gc.compose()
  gulp.task('test').unwrap()()

  t.ok(fnGotCalled, 'wrapped function got executed')

  t.end()
})

tape('.fn() should wrap a composable', t => {
  let gc = new gulpCompose()

  let task1Called = false
  let task1Fn = done => {
    task1Called = true
    done()
  }

  let task2Called = false
  let task2Fn = done => {
    t.comment('hallo')
    task2Called = true
    done()
  }

  gc.task('test', gc.fn(gc.series(
      task1Fn,
      task2Fn
  )))


  let gulp = gc.compose()
  gulp.task('test').unwrap()(done => {
    t.ok(task1Called, 'task1Fn got called')
    t.ok(task2Called, 'task2Fn got called')

    t.end()
  })
})

function updateTempFile(path) {
  setTimeout(() => {
    console.log('Changed', path)
    fs.appendFileSync(path, ' changed')
  }, 125)
}

tape('.watch() should wrap a gulp.watch', t => {
  let gc = new gulpCompose()
  let tmpFile = tempy.file()

  let watcher

  let gcWatcher = gc.watch(tmpFile, () => {
    t.comment('cb got called')
    watcher.close()
    t.end()
  })

  watcher = gcWatcher.compose(gc.gulp)
  updateTempFile(tmpFile)
})
