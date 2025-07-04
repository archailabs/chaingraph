/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type {
  AnyPort,
  ExecutionContext,
  IObjectSchema,
  IPortConfig,
  NodeEvent,
  NodeExecutionResult,
  ObjectPortValue,
  PortConnectedEvent,
  PortDisconnectedEvent,
} from '@badaitech/chaingraph-types'
import { BaseNode, findPort, Input, Node, NodeEventType, Output, PortAny, PortArray } from '@badaitech/chaingraph-types'
import { NODE_CATEGORIES } from '../../categories'

@Node({
  type: 'ArrayNode',
  title: 'Array Node',
  description: 'A node that outputs an array',
  category: NODE_CATEGORIES.BASIC_VALUES,
})
class ArrayNode extends BaseNode {
  @Input()
  @PortAny({
    title: 'Array Items Schema',
    description: 'Schema used for array items. You can connect a port to this port and it will be used to generate the schema for the array items.',
  })
  itemSchema: any

  @Output()
  @PortArray({
    title: 'Array',
    description: 'The output array.',
    defaultValue: [],
    itemConfig: {
      type: 'any',
      ui: {
        hideEditor: false,
      },
    },
    isMutable: true,
    ui: {
      hideEditor: false,
      addItemFormHidden: false,
      allowedTypes: ['string', 'number', 'boolean'],
    },
  })
  array: any[] = []

  async execute(context: ExecutionContext): Promise<NodeExecutionResult> {
    // This node simply outputs the default number value.
    return {}
  }

  /**
   * Handle node events to maintain port synchronization
   */
  async onEvent(event: NodeEvent): Promise<void> {
    await super.onEvent(event)

    switch (event.type) {
      case NodeEventType.PortConnected:
        await this.handlePortConnected(event as PortConnectedEvent)
        break
      case NodeEventType.PortDisconnected:
        await this.handlePortDisconnected(event as PortDisconnectedEvent)
        break
    }
  }

  /**
   * Handle port connection events - specifically for "any" ports
   */
  private async handlePortConnected(event: PortConnectedEvent): Promise<void> {
    // Only process connections from our own inputs and for "any" ports
    if (event.sourceNode.id !== this.id) {
      return
    }

    // Get the source port and its configuration
    const sourcePort = event.sourcePort
    if (!sourcePort) {
      return
    }
    const sourcePortConfig = sourcePort.getConfig()

    // Only process the itemSchema port and ensure it is an input port without a parent
    // and of type 'any'
    if (
      !sourcePortConfig
      || sourcePortConfig.key !== 'itemSchema'
      || sourcePortConfig.direction !== 'input'
      || sourcePortConfig.parentId
      || sourcePortConfig.type !== 'any'
    ) {
      return
    }

    // Get the underlying type from the itemSchema port
    const itemSchemaPort = sourcePort as AnyPort
    let underlyingType = itemSchemaPort.getRawConfig().underlyingType
    if (!underlyingType) {
      // TODO: Find away to disconnect port
      return
    }

    // Iterate through the underlying type to find the actual type
    if (underlyingType.type === 'any') {
      while (underlyingType.type === 'any') {
        if (underlyingType.type === 'any' && underlyingType.underlyingType) {
          underlyingType = underlyingType.underlyingType
        }
      }
    }

    // Generate title for the array port based on targetPorts title otherwise the underlying type
    const title = `Array of ${event.targetPort.getConfig().title || underlyingType.type}`

    // If finally the underlying type is any or stream we dont use the config for the array port
    if (['any', 'stream'].includes(underlyingType.type)) {
      // TODO: Find away to disconnect port
      return
    }

    // Set the array port configuration based on the underlying type
    this.setArrayPortConfig(title, this.createPortConfig(underlyingType))
  }

  /**
   * Handle port connection events - specifically for "any" ports
   */
  private async handlePortDisconnected(event: PortDisconnectedEvent): Promise<void> {
    // Only process connections from our own inputs and for "any" ports
    if (event.sourceNode.id !== this.id) {
      return
    }

    const sourcePort = event.sourcePort
    const sourcePortConfig = sourcePort.getConfig()

    // Only process the itemSchema port and ensure it is an input port without a parent
    if (
      sourcePortConfig.key !== 'itemSchema'
      || sourcePortConfig.direction !== 'input'
      || sourcePortConfig.parentId
    ) {
      return
    }

    // Set the array port configuration to default any configuration
    const anySchema: IPortConfig = {
      type: 'any',
      ui: {
        hideEditor: false,
      },
    }
    this.setArrayPortConfig('Array', anySchema)
  }

  /**
   * set item configuration for the array port
   */
  private setArrayPortConfig(title: string, itemConfig: IPortConfig): void {
    // get the array port and update its schema
    const arrayPort = findPort(this, (port) => {
      return port.getConfig().key === 'array'
        && !port.getConfig().parentId
        && port.getConfig().direction === 'output'
    })

    if (!arrayPort) {
      return
    }

    const arrayPortConfig = arrayPort.getConfig()
    if (arrayPortConfig.type !== 'array') {
      return
    }

    // if type changed remove all array elements in descending order
    if (arrayPortConfig.itemConfig.type !== itemConfig.type) {
      for (let index = arrayPort.getValue().length - 1; index >= 0; index--) {
        this.removeArrayItem(arrayPort, index)
      }
    }

    // Change item configuration for the array port
    arrayPort.setConfig({
      ...arrayPortConfig,
      title,
      itemConfig,
      ui: {
        ...arrayPortConfig.ui,
      },
    })
    this.updateArrayItemConfig(arrayPort)
  }

  /**
   * Create port configuration based on the provided port configuration and merge it with the default port configuration
   */
  private createPortConfig(portConfig: IPortConfig, isChildConfig: boolean = false): IPortConfig {
    let specificSchema: IPortConfig = {
      type: 'any',
      defaultValue: undefined,
    }

    // Create the appropriate schema object based on port type
    switch (portConfig.type) {
      case 'string': {
        specificSchema = {
          ...portConfig,
          defaultValue: portConfig.defaultValue || '',
        }
        break
      }
      case 'number': {
        specificSchema = {
          ...portConfig,
          defaultValue: portConfig.defaultValue ?? 0,
        }
        break
      }
      case 'boolean': {
        specificSchema = {
          ...portConfig,
          defaultValue: portConfig.defaultValue ?? false,
        }
        break
      }
      case 'array': {
        specificSchema = {
          ...portConfig,
          itemConfig: this.createPortConfig(portConfig.itemConfig, true),
          defaultValue: portConfig.defaultValue || [],
          isMutable: true,
        }
        break
      }
      case 'object': {
        const objectSchema = this.createObjectSchema(portConfig.schema)
        const defaultValue = this.createObjectDefaultValues(objectSchema)
        specificSchema = {
          ...portConfig,
          schema: objectSchema,
          defaultValue,
          isSchemaMutable: false,
          ui: {
            keyDeletable: false,
          },
        }
        break
      }
      case 'enum': {
        specificSchema = {
          ...portConfig,
          defaultValue: portConfig.defaultValue || '',
        }
        break
      }
      case 'stream': {
        specificSchema = {
          ...portConfig,
          itemConfig: this.createPortConfig(portConfig.itemConfig, true),
        }
        break
      }
      case 'any': {
        specificSchema = {
          ...portConfig,
          defaultValue: portConfig.defaultValue,
        }
        break
      }
    }

    specificSchema = {
      ...specificSchema,
      id: undefined,
      title: isChildConfig ? specificSchema.title : undefined,
      description: isChildConfig ? specificSchema.description : undefined,
      direction: 'output',
      ui: {
        ...specificSchema.ui,
        hideEditor: false,
      },
    }

    return specificSchema
  }

  /**
   * Create object schema for object ports
   */
  private createObjectSchema(schema?: IObjectSchema): IObjectSchema {
    if (!schema || !schema.properties) {
      return { properties: {} }
    }

    const properties: Record<string, IPortConfig> = {}
    for (const key in schema.properties) {
      properties[key] = this.createPortConfig(schema.properties[key], true)
    }

    return {
      properties,
    }
  }

  /**
   * Create default values for object ports based on the schema
   */
  private createObjectDefaultValues(schema?: IObjectSchema): ObjectPortValue<any> {
    if (!schema || !schema.properties) {
      return {}
    }

    const defaultValue: ObjectPortValue<any> = {}
    for (const key in schema.properties) {
      defaultValue[key] = schema.properties[key].defaultValue
    }

    return defaultValue
  }
}

export default ArrayNode
