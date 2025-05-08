/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { ExecutionContext, NodeExecutionResult } from '@badaitech/chaingraph-types'
import { BaseNode, Boolean, Input, Node, Output } from '@badaitech/chaingraph-types'
import { NODE_CATEGORIES } from '../../categories'

@Node({
  type: 'OrNode',
  title: 'Or',
  description: 'Performs logical OR operation on two boolean values',
  category: NODE_CATEGORIES.MATH,
  tags: ['math', 'logic', 'boolean', 'or'],
})
class OrNode extends BaseNode {
  @Input()
  @Boolean({
    title: 'Input X',
    description: 'First boolean value to use in the logical OR operation',
    defaultValue: false,
  })
  inputX: boolean = false

  @Input()
  @Boolean({
    title: 'Input Y',
    description: 'Second boolean value to use in the logical OR operation',
    defaultValue: false,
  })
  inputY: boolean = false

  @Output()
  @Boolean({
    title: 'Result',
    description: 'Boolean result of the logical OR operation',
  })
  result: boolean = false

  async execute(context: ExecutionContext): Promise<NodeExecutionResult> {
    // Apply logical OR operation
    this.result = this.inputX || this.inputY
    return {}
  }
}

export default OrNode
