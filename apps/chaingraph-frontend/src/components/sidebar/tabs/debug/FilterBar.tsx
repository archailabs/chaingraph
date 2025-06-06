/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExecutionEventEnum } from '@badaitech/chaingraph-types'
import { motion } from 'framer-motion'

interface FilterBarProps {
  selectedTypes: Set<ExecutionEventEnum>
  onSelectionChange: (types: Set<ExecutionEventEnum>) => void
}

export function FilterBar({ selectedTypes, onSelectionChange }: FilterBarProps) {
  const eventGroups = {
    Flow: [
      ExecutionEventEnum.FLOW_STARTED,
      ExecutionEventEnum.FLOW_COMPLETED,
      ExecutionEventEnum.FLOW_FAILED,
      ExecutionEventEnum.FLOW_CANCELLED,
      ExecutionEventEnum.FLOW_PAUSED,
      ExecutionEventEnum.FLOW_RESUMED,
    ],
    Node: [
      ExecutionEventEnum.NODE_STARTED,
      ExecutionEventEnum.NODE_COMPLETED,
      ExecutionEventEnum.NODE_FAILED,
      ExecutionEventEnum.NODE_SKIPPED,
      ExecutionEventEnum.NODE_STATUS_CHANGED,
    ],
    Edge: [
      ExecutionEventEnum.EDGE_TRANSFER_STARTED,
      ExecutionEventEnum.EDGE_TRANSFER_COMPLETED,
      ExecutionEventEnum.EDGE_TRANSFER_FAILED,
    ],
    Debug: [
      ExecutionEventEnum.DEBUG_BREAKPOINT_HIT,
      ExecutionEventEnum.NODE_DEBUG_LOG_STRING,
    ],
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(eventGroups).map(([group, events]) => (
        <Button
          key={group}
          variant="outline"
          size="sm"
          className={cn(
            'relative',
            events.every(e => selectedTypes.has(e)) && 'bg-primary/10',
          )}
          onClick={() => {
            const newSelection = new Set(selectedTypes)
            const allSelected = events.every(e => selectedTypes.has(e))

            events.forEach((event) => {
              if (allSelected) {
                newSelection.delete(event)
              } else {
                newSelection.add(event)
              }
            })

            onSelectionChange(newSelection)
          }}
        >
          {group}
          {events.every(e => selectedTypes.has(e)) && (
            <motion.div
              className="absolute inset-0 bg-primary/10 rounded-md"
              layoutId="filter-highlight"
            />
          )}
        </Button>
      ))}
    </div>
  )
}
