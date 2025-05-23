/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { CategorizedNodes, FlowMetadata } from '@badaitech/chaingraph-types'
import { fetchCategorizedNodesFx } from './categories'
import { globalReset } from './common'
import { loadFlowsListFx } from './flow'
import { initInterpolatorFx } from './nodes'

/**
 * Initialize all stores and load initial data
 */
export async function initializeStores(callback?: (
  categorizedNodes: CategorizedNodes[],
  flows: FlowMetadata[],
) => void | Promise<void>) {
  try {
    initInterpolatorFx()

    // Initialize stores in parallel
    const result = await Promise.all([
      fetchCategorizedNodesFx(),
      loadFlowsListFx(),
    ])

    // callback with the results
    if (callback) {
      const [categorizedNodes, flows] = result
      await callback(categorizedNodes, flows)
    }

    console.debug('Stores initialized successfully')
  } catch (error) {
    console.error('Failed to initialize stores:', error)
    throw error
  }
}

export function reset() {
  globalReset()
}
