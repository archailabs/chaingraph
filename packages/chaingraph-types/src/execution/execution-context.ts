/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { ExecutionEvent } from '../flow'
import type { INode } from '../node'
import type { EmittedEventContext } from './emitted-event-context'
import { Buffer } from 'node:buffer'
import { subtle } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { EventQueue } from '../utils'

// Generic integration interface that can handle any integration type
export type IntegrationContext = Record<string, unknown>

// Event emitted by nodes for triggering listeners
export interface EmittedEvent {
  id: string
  type: string
  data: any
  emittedAt: number
  emittedBy: string // nodeId
  childExecutionId?: string
  processed?: boolean
}

export class ExecutionContext {
  public readonly executionId: string
  public readonly startTime: Date
  public readonly flowId?: string
  public readonly metadata: Record<string, unknown>
  public readonly abortController: AbortController

  private ecdhKeyPair?: CryptoKeyPair | null = null

  // debug log events queue
  private readonly eventsQueue: EventQueue<ExecutionEvent>

  // integrations
  public readonly integrations: IntegrationContext

  // Event-driven execution support (optional)
  public readonly parentExecutionId?: string
  public emittedEvents?: EmittedEvent[]
  public readonly eventData?: EmittedEventContext
  public readonly isChildExecution?: boolean
  public currentNodeId?: string // Track current executing node for event emission
  public readonly executionDepth: number // Track depth to prevent infinite cycles

  public readonly getNodeById: (nodeId: string) => INode | undefined
  // findNode is a utility function to find a node by a predicate
  public readonly findNodes: (predicate: (node: INode) => boolean) => INode[] | undefined

  // TODO: chat api gql client
  // TODO: agent session
  // TODO: chat room meta + participants agents?
  // TODO: input chat message / event / tweet / telegram message / some external events

  constructor(
    flowId: string,
    abortController: AbortController,
    metadata?: Record<string, unknown>,
    executionId?: string,
    integrations?: IntegrationContext,
    parentExecutionId?: string,
    eventData?: EmittedEventContext,
    isChildExecution?: boolean,
    executionDepth?: number,
    getNodeById?: (nodeId: string) => INode | undefined,
    findNodes?: (predicate: (node: INode) => boolean) => INode[] | undefined,
  ) {
    this.executionId = executionId || uuidv4()
    this.startTime = new Date()
    this.flowId = flowId
    this.metadata = metadata || {}
    this.abortController = abortController
    this.integrations = integrations || {}
    this.eventsQueue = new EventQueue<ExecutionEvent>(10)
    this.getNodeById = getNodeById || (() => undefined)
    this.findNodes = findNodes || ((predicate: (node: INode) => boolean) => undefined)

    // Event-driven execution support
    this.parentExecutionId = parentExecutionId
    this.eventData = eventData
    this.isChildExecution = isChildExecution
    this.executionDepth = executionDepth || 0
    if (this.eventData || this.parentExecutionId) {
      this.emittedEvents = []
    }
  }

  get abortSignal(): AbortSignal {
    return this.abortController.signal
  }

  private async generateECDHKeyPair() {
    this.ecdhKeyPair = await subtle.generateKey({
      name: 'ECDH',
      namedCurve: 'P-256',
    }, false, ['deriveKey'])
  }

  async getECDHKeyPair(): Promise<CryptoKeyPair> {
    if (this.ecdhKeyPair === null || this.ecdhKeyPair === undefined) {
      await this.generateECDHKeyPair()
      const publicKey = await subtle.exportKey('raw', this.ecdhKeyPair!.publicKey)
      console.trace(
        `[ExecutionContext] Generated new ECDH key pair for execution ${this.executionId}, public key: ${Buffer.from(publicKey).toString('base64')}`,
      )
    } else {
      const publicKey = await subtle
        .exportKey('raw', this.ecdhKeyPair!.publicKey)
      console.trace(
        `[ExecutionContext] Using existing ECDH key pair for execution ${this.executionId}, public key: ${Buffer.from(publicKey).toString('base64')}`,
      )
    }

    return this.ecdhKeyPair!
  }

  async sendEvent(event: ExecutionEvent): Promise<void> {
    return this.eventsQueue?.publish(event)
  }

  getEventsQueue(): EventQueue<ExecutionEvent> {
    return this.eventsQueue as EventQueue<ExecutionEvent>
  }

  /**
   * Helper method to get a specific integration by type
   * @param type The integration type to retrieve
   * @returns The integration data or undefined if not found
   */
  getIntegration<T = unknown>(type: string): T | undefined {
    if (!this.integrations) {
      return undefined
    }
    return this.integrations[type] as T
  }

  /**
   * Emit an event that can trigger listener nodes
   * @param eventType The type of event to emit
   * @param data The event data
   */
  emitEvent(eventType: string, data: any): void {
    if (!this.emittedEvents) {
      this.emittedEvents = []
    }

    this.emittedEvents.push({
      id: uuidv4(),
      type: eventType,
      data,
      emittedAt: Date.now(),
      emittedBy: this.currentNodeId || 'unknown',
    })
  }

  /**
   * Clone this context for a child execution
   * @param eventData The event data for the child execution
   * @param childExecutionId The ID for the child execution
   */
  cloneForChildExecution(eventData: EmittedEventContext, childExecutionId: string): ExecutionContext {
    const ctx = new ExecutionContext(
      this.flowId!,
      // new AbortController(), // New abort controller for child
      this.abortController,
      { ...this.metadata, parentExecutionId: this.executionId },
      childExecutionId,
      this.integrations, // Share integrations
      this.executionId, // Parent execution ID
      eventData,
      true, // Is child execution
    )
    ctx.ecdhKeyPair = this.ecdhKeyPair // Share key pair if needed
    return ctx
  }
}
