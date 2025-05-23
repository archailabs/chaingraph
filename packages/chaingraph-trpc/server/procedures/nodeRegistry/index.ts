/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { CategorizedNodes } from '@badaitech/chaingraph-types'
import { z } from 'zod'
import { authedProcedure, router } from '../../trpc'

export const nodeRegistryProcedures = router({
  // Get all nodes grouped by categories
  getCategorizedNodes: authedProcedure
    .query(async ({ ctx }): Promise<CategorizedNodes[]> => {
      // return ctx.nodesCatalog.getAllNodes()
      const nodes = ctx.nodesCatalog.getAllNodes()
      for (const category of nodes) {
        for (const node of category.nodes) {
          if (typeof node.version === 'string') {
            console.warn(`Node "${node.type}" has a string version`)
          }
        }
      }

      return nodes
    }),

  // Search nodes across all categories
  searchNodes: authedProcedure
    .input(z.string())
    .query(async ({ ctx, input }): Promise<CategorizedNodes[]> => {
      return ctx.nodesCatalog.searchNodes(input)
    }),

  // Get nodes for specific category
  getNodesByCategory: authedProcedure
    .input(z.string())
    .query(async ({ ctx, input }): Promise<CategorizedNodes | undefined> => {
      return ctx.nodesCatalog.getNodesByCategory(input)
    }),

  // Get available categories
  getCategories: authedProcedure
    .query(async ({ ctx }) => {
      return ctx.nodesCatalog.getCategories()
    }),

  // Get specific node type
  getNodeType: authedProcedure
    .input(z.string())
    .query(async ({ input: nodeType, ctx }) => {
      const node = ctx.nodesCatalog.getNodeByType(nodeType)
      if (!node) {
        throw new Error(`Node type "${nodeType}" not found`)
      }
      return node
    }),

  // Legacy procedure for backward compatibility
  listAvailableTypes: authedProcedure
    .query(async ({ ctx }) => {
      return ctx.nodesCatalog.getAllNodes().flatMap((category: CategorizedNodes) => category.nodes)
    }),
})
