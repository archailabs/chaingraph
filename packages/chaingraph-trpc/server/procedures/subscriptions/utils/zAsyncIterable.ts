/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { TrackedEnvelope } from '@trpc/server'
import { isTrackedEnvelope, tracked } from '@trpc/server'
import { z } from 'zod'

function isAsyncIterable<TValue, TReturn = unknown>(
  value: unknown,
): value is AsyncIterable<TValue, TReturn> {
  return !!value && typeof value === 'object' && Symbol.asyncIterator in value
}
const trackedEnvelopeSchema
  = z.custom<TrackedEnvelope<unknown>>(isTrackedEnvelope)
/**
 * A Zod schema helper designed specifically for validating async iterables. This schema ensures that:
 * 1. The value being validated is an async iterable.
 * 2. Each item yielded by the async iterable conforms to a specified type.
 * 3. The return value of the async iterable, if any, also conforms to a specified type.
 */
export function zAsyncIterable<
  TYieldIn,
  TYieldOut,
  TReturnIn = void,
  TReturnOut = void,
  Tracked extends boolean = false,
>(opts: {
  /**
   * Validate the value yielded by the async generator
   */
  yield: z.ZodType<TYieldIn, any, TYieldOut>
  /**
   * Validate the return value of the async generator
   * @remark not applicable for subscriptions
   */
  return?: z.ZodType<TReturnIn, any, TReturnOut>
  /**
   * Whether if the yielded values are tracked
   * @remark only applicable for subscriptions
   */
  tracked?: Tracked
}) {
  return z
    .custom<
    AsyncIterable<
      Tracked extends true ? TrackedEnvelope<TYieldIn> : TYieldIn,
      TReturnIn
    >
  >(val => isAsyncIterable(val))
    .transform(async function* (iter) {
      const iterator = iter[Symbol.asyncIterator]()
      try {
        let next
        // eslint-disable-next-line no-cond-assign
        while ((next = await iterator.next()) && !next.done) {
          if (opts.tracked) {
            const [id, data] = trackedEnvelopeSchema.parse(next.value)
            yield tracked(id, await opts.yield.parseAsync(data))
            continue
          }
          yield opts.yield.parseAsync(next.value)
        }
        if (opts.return) {
          return await opts.return.parseAsync(next.value)
        }
      } finally {
        await iterator.return?.()
      }
    }) as z.ZodType<
    AsyncIterable<
      Tracked extends true ? TrackedEnvelope<TYieldIn> : TYieldIn,
      TReturnIn,
      unknown
    >,
    any,
    AsyncIterable<
      Tracked extends true ? TrackedEnvelope<TYieldOut> : TYieldOut,
      TReturnOut,
      unknown
    >
  >
}
