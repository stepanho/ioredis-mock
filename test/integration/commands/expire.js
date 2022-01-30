import Promise from 'bluebird'
import Redis from 'ioredis'

// eslint-disable-next-line import/no-relative-parent-imports
import { runTwinSuite } from '../../../test-utils'

runTwinSuite('expire', command => {
  describe(command, () => {
    it('should delete key on get', () => {
      const redis = new Redis({
        data: {
          foo: 'bar',
        },
      })
      return Promise.all([
        redis[command]('foo', 1),
        redis.get('foo'),
        Promise.delay(1500).then(() => {
          return redis.get('foo')
        }),
      ]).then(([status, beforeExpire, afterExpire]) => {
        expect(status).toBe(1)
        expect(beforeExpire).toBe('bar')
        expect(afterExpire).toBe(null)
        expect(redis.data.has('foo')).toBe(false)
      })
    })

    it('should delete key on garbage collect', () => {
      const redis = new Redis({
        data: {
          foo: 'bar',
        },
      })
      return redis[command]('foo', 0).then(() => {
        return expect(redis.data.has('foo')).toBe(false)
      })
    })

    it('should return 0 if key does not exist', () => {
      const redis = new Redis()
      return redis[command]('foo', 1).then(status => {
        return expect(status).toBe(0)
      })
    })

    it('should remove expire on SET', () => {
      const redis = new Redis({
        data: {
          foo: 'bar',
        },
      })
      return redis[command]('foo', 1)
        .then(() => {
          return redis.set('foo', 'baz')
        })
        .then(() => {
          return expect(redis.expires.has('foo')).toBe(false)
        })
    })

    it('should remove expire on GETSET', () => {
      const redis = new Redis({
        data: {
          foo: 'bar',
        },
      })
      return redis[command]('foo', 1)
        .then(() => {
          return redis.getset('foo', 'baz')
        })
        .then(() => {
          return expect(redis.expires.has('foo')).toBe(false)
        })
    })

    it('should move expire on RENAME', () => {
      const redis = new Redis({
        data: {
          foo: 'bar',
        },
      })
      return redis[command]('foo', 1)
        .then(() => {
          return redis.rename('foo', 'baz')
        })
        .then(() => {
          return expect(redis.expires.has('baz')).toBe(true)
        })
    })

    it('should emit keyspace notification if configured', done => {
      const redis = new Redis({ notifyKeyspaceEvents: 'gK' }) // gK: generic Keyspace
      const redisPubSub = redis.duplicate()
      redisPubSub.on('message', (channel, message) => {
        expect(channel).toBe('__keyspace@0__:foo')
        expect(message).toBe('expire')
        done()
      })
      redisPubSub.subscribe('__keyspace@0__:foo').then(() => {
        return redis.set('foo', 'value').then(() => {
          return redis[command]('foo', 1)
        })
      })
    })
  })
})