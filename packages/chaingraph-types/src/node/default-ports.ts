/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { BooleanPortConfig, IPortConfig, StringPortConfig } from '../port'
import type { FlowPorts } from './types'
import { generatePortID } from '../port'
import { PortDirection } from '../port'

export const flowInID = '__execute'
export const flowOutID = '__success'
export const errorID = '__error'
export const errorMessageID = '__errorMessage'

/**
 * Creates the default flowIn port configuration
 */
export function createDefaultFlowInPort(): BooleanPortConfig {
  return {
    type: 'boolean',
    key: flowInID,
    id: generatePortID('execute'),
    title: 'Execute',
    description: 'Whether the node should execute',
    direction: PortDirection.Input,
    defaultValue: true,
    // ui: {
    //   bgColor: '#63f54d',
    //   borderColor: '#1e4b18',
    // },
    metadata: {
      isSystemPort: true,
      portCategory: 'flow',
    },
  }
}

/**
 * Creates the default flowOut port configuration
 */
export function createDefaultFlowOutPort(): BooleanPortConfig {
  return {
    type: 'boolean',
    key: flowOutID,
    id: generatePortID('success'),
    title: 'Success',
    description: 'Whether the node executed successfully',
    direction: PortDirection.Output,
    defaultValue: true,
    // ui: {
    //   bgColor: '#4a90e2',
    //   borderColor: '#2c5282',
    // },
    metadata: {
      isSystemPort: true,
      portCategory: 'flow',
    },
  }
}

/**
 * Creates the default error port configuration
 */
export function createDefaultErrorPort(): BooleanPortConfig {
  return {
    type: 'boolean',
    key: errorID,
    id: generatePortID('error'),
    title: 'Error',
    description: 'Whether an error occurred during execution',
    direction: PortDirection.Output,
    defaultValue: false,
    // ui: {
    //   bgColor: '#e53e3e',
    //   borderColor: '#822727',
    // },
    metadata: {
      isSystemPort: true,
      portCategory: 'error',
    },
  }
}

/**
 * Creates the default errorMessage port configuration
 */
export function createDefaultErrorMessagePort(): StringPortConfig {
  return {
    type: 'string',
    key: errorMessageID,
    id: generatePortID('errorMessage'),
    title: 'Error Message',
    description: 'The error message if an error occurred during execution',
    direction: PortDirection.Output,
    defaultValue: '',
    // ui: {
    //   bgColor: '#e53e3e',
    //   borderColor: '#822727',
    // },
    metadata: {
      isSystemPort: true,
      portCategory: 'error',
    },
  }
}

/**
 * Gets all default port configurations based on the provided FlowPorts settings
 * @param flowPorts FlowPorts configuration
 * @returns Array of default port configurations
 */
export function getDefaultPortConfigs(flowPorts?: FlowPorts): IPortConfig[] {
  const configs: IPortConfig[] = []

  // Add flow ports if not disabled
  if (!flowPorts?.disabledFlowPorts) {
    configs.push(createDefaultFlowInPort())
    configs.push(createDefaultFlowOutPort())
  }

  // Add error ports if not disabled
  if (!flowPorts?.disabledError) {
    configs.push(createDefaultErrorPort())
    configs.push(createDefaultErrorMessagePort())
  }

  return configs
}
