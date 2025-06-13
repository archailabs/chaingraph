/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { ExecutionContext } from '../../execution'
import type { NodeExecutionResult } from '../types'
import superjson from 'superjson'
import { beforeAll, describe, expect, it } from 'vitest'
import { Input, Node, Port } from '../../decorator'
import {
  ArrayPortPlugin,
  EnumPortPlugin,
  NumberPortPlugin,
  ObjectPortPlugin,
  PortPluginRegistry,
  StringPortPlugin,
} from '../../port'
import { BaseNode } from '../base-node'
import { registerNodeTransformers } from '../json-transformers'
import { findPort } from '../traverse-ports'
import 'reflect-metadata'

PortPluginRegistry.getInstance().register(StringPortPlugin)
PortPluginRegistry.getInstance().register(NumberPortPlugin)
PortPluginRegistry.getInstance().register(ArrayPortPlugin)
PortPluginRegistry.getInstance().register(ObjectPortPlugin)
PortPluginRegistry.getInstance().register(EnumPortPlugin)

enum Color {
  Red = 'Red',
  Green = 'Green',
  Blue = 'Blue',
}

@Node({
  type: 'EnumNode',
  title: 'Enum Node',
  description: 'Node with an enum port',
})
class EnumNode extends BaseNode {
  @Input()
  @Port({
    type: 'enum' as const,
    options: [
      {
        id: Color.Red,
        type: 'string',
        title: 'Red',
        defaultValue: Color.Red,
      },
      {
        id: Color.Green,
        type: 'string',
        title: 'Green',
        defaultValue: Color.Green,
      },
      {
        id: Color.Blue,
        type: 'string',
        title: 'Blue',
        defaultValue: Color.Blue,
      },
    ],
  })
  favoriteColor: Color = Color.Red

  async execute(context: ExecutionContext): Promise<NodeExecutionResult> {
    return {}
  }
}

describe('enum node serialization', () => {
  beforeAll(() => {
    // Register all port types
    registerNodeTransformers()
  })

  it('serializes and deserializes a node with an enum port', async () => {
    const enumNode = new EnumNode('enum-node')
    await enumNode.initialize()

    const json = superjson.serialize(enumNode)
    const parsed = superjson.deserialize(json) as EnumNode

    expect(parsed).toBeDefined()
    expect(parsed.metadata).toEqual(enumNode.metadata)
    expect(parsed.status).toEqual(enumNode.status)

    const colorPort = findPort(enumNode, port => port.getConfig().key === 'favoriteColor')
    enumNode.favoriteColor = Color.Green
    expect(colorPort?.getValue()).toBe(Color.Green)

    try {
      // @ts-expect-error invalid value test
      enumNode.favoriteColor = 'invalid'
    } catch (e: any) {
      expect(e.message).toBe('Value validation failed in setValue.')
    }
  })
})
