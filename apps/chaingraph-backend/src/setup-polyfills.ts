/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

/// <reference lib="dom" />

/**
 * TextDecoderStream polyfill based on Node.js' implementation https://github.com/nodejs/node/blob/3f3226c8e363a5f06c1e6a37abd59b6b8c1923f1/lib/internal/webstreams/encoding.js#L121-L200 (MIT License)
 */
class TextDecoderStream {
  #handle: TextDecoder

  #transform = new TransformStream({
    transform: (chunk, controller) => {
      const value = this.#handle.decode(chunk, { stream: true })

      if (value) {
        controller.enqueue(value)
      }
    },
    flush: (controller) => {
      const value = this.#handle.decode()
      if (value) {
        controller.enqueue(value)
      }

      controller.terminate()
    },
  })

  constructor(encoding = 'utf-8', options: TextDecoderOptions = {}) {
    this.#handle = new TextDecoder(encoding, options)
  }

  get encoding() {
    return this.#handle.encoding
  }

  get fatal() {
    return this.#handle.fatal
  }

  get ignoreBOM() {
    return this.#handle.ignoreBOM
  }

  get readable() {
    return this.#transform.readable
  }

  get writable() {
    return this.#transform.writable
  }

  get [Symbol.toStringTag]() {
    return 'TextDecoderStream'
  }
}

/**
 * TextEncoderStream polyfill based on Node.js' implementation https://github.com/nodejs/node/blob/3f3226c8e363a5f06c1e6a37abd59b6b8c1923f1/lib/internal/webstreams/encoding.js#L38-L119 (MIT License)
 */
class TextEncoderStream {
  #pendingHighSurrogate: string | null = null

  #handle = new TextEncoder()

  #transform = new TransformStream<string, Uint8Array>({
    transform: (chunk, controller) => {
      // https://encoding.spec.whatwg.org/#encode-and-enqueue-a-chunk
      chunk = String(chunk)

      let finalChunk = ''
      for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i]
        const codeUnit = item.charCodeAt(0)
        if (this.#pendingHighSurrogate !== null) {
          const highSurrogate = this.#pendingHighSurrogate

          this.#pendingHighSurrogate = null
          if (codeUnit >= 0xDC00 && codeUnit <= 0xDFFF) {
            finalChunk += highSurrogate + item
            continue
          }

          finalChunk += '\uFFFD'
        }

        if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF) {
          this.#pendingHighSurrogate = item
          continue
        }

        if (codeUnit >= 0xDC00 && codeUnit <= 0xDFFF) {
          finalChunk += '\uFFFD'
          continue
        }

        finalChunk += item
      }

      if (finalChunk) {
        controller.enqueue(this.#handle.encode(finalChunk))
      }
    },

    flush: (controller) => {
      // https://encoding.spec.whatwg.org/#encode-and-flush
      if (this.#pendingHighSurrogate !== null) {
        controller.enqueue(new Uint8Array([0xEF, 0xBF, 0xBD]))
      }
    },
  })

  get encoding() {
    return this.#handle.encoding
  }

  get readable() {
    return this.#transform.readable
  }

  get writable() {
    return this.#transform.writable
  }

  get [Symbol.toStringTag]() {
    return 'TextEncoderStream'
  }
}

export function setupPolyfills() {
  globalThis.TextDecoderStream = TextDecoderStream
  globalThis.TextEncoderStream = TextEncoderStream
}
