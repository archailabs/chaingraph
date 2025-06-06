/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { IObjectSchema, IPortConfig } from '../port'

import {
  getObjectSchemaMetadata,
  getPortsMetadata,
  setObjectSchemaMetadata,
} from './metadata-storage'
import { normalizeSchema } from './recursive-normalization'
import 'reflect-metadata'

/**
 * Updated resolveObjectSchema: If the argument is a constructor (function),
 * then retrieves its stored schema metadata. If it's already a plain object,
 * then recursively normalizes it.
 *
 * @param schemaOrConstructor - An object schema or a constructor decorated with @ObjectSchema.
 * @returns The resolved and normalized object schema.
 */
export function resolveObjectSchema(
  schemaOrConstructor: IObjectSchema | Function,
): IObjectSchema {
  if (typeof schemaOrConstructor === 'function') {
    const schema = getObjectSchema(schemaOrConstructor)
    if (!schema) {
      throw new Error(`Class ${schemaOrConstructor.name} is not decorated with @ObjectSchema`)
    }
    return schema
  }

  return normalizeSchema(schemaOrConstructor as IObjectSchema)
}

/**
 * The @ObjectSchemaDecorator decorator collects all properties decorated with @Port
 * (via its metadata) and builds an explicit object schema. It then normalizes the schema
 * recursively.
 *
 * @param options - Optional additional settings for the object schema.
 */
export function ObjectSchema(options?: Partial<IObjectSchema>): ClassDecorator {
  return (target: any) => {
    const portsConfig = getPortsMetadata(target)

    const properties: Record<string, IPortConfig> = {}
    for (const [key, config] of portsConfig.entries()) {
      if (typeof config === 'object' && 'type' in config && config.type === 'object' && config.schema) {
        if (typeof config.schema === 'function') {
          config.schema = resolveObjectSchema(config.schema)
        }
      }
      properties[key.toString()] = config
    }

    const schema: IObjectSchema = {
      type: target.name,
      properties,
      isObjectSchema: true,
      ...options,
    }

    const normalizedSchema = normalizeSchema(schema)
    setObjectSchemaMetadata(target, normalizedSchema)
  }
}

/**
 * Helper function to retrieve the stored object schema from a decorated class.
 *
 * @param target - The class whose schema should be retrieved.
 * @returns The object schema or undefined if not found.
 */
export function getObjectSchema(target: any): IObjectSchema | undefined {
  return getObjectSchemaMetadata(target)
}
