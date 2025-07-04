/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type {
  EncryptedSecretValue,
  ExecutionContext,
  NodeExecutionResult,
  SecretTypeMap,
} from '@badaitech/chaingraph-types'
import {
  PortSecret,
} from '@badaitech/chaingraph-types'
import {
  BaseNode,
  Input,
  MultiChannel,
  Node,
  ObjectSchema,
  Output,
  PortEnumFromObject,
  PortNumber,
  PortStream,
  PortString,
} from '@badaitech/chaingraph-types'
import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage } from '@langchain/core/messages'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ChatOpenAI } from '@langchain/openai'
import { NODE_CATEGORIES } from '../../categories'

export enum LLMModels {
  // GPT-4.1 Family
  Gpt41 = 'gpt-4.1',
  Gpt41Mini = 'gpt-4.1-mini',
  Gpt41Nano = 'gpt-4.1-nano',

  // GPT-4o Family
  Gpt4oMini = 'gpt-4o-mini',
  Gpt4o = 'gpt-4o',

  // O-Series Reasoning Models
  O1 = 'o1',
  O1Mini = 'o1-mini',
  O3 = 'o3',
  GptO3Mini = 'o3-mini',
  O3Pro = 'o3-pro',
  O4Mini = 'o4-mini',

  // Claude Models
  ClaudeSonnet4_20250514 = 'claude-sonnet-4-20250514',
  ClaudeOpus4_20250514 = 'claude-opus-4-20250514',
  Claude37Sonnet20250219 = 'claude-3-7-sonnet-20250219',
  Claude35Sonnet20241022 = 'claude-3-5-sonnet-20241022',

  // Deepseek Models
  DeepseekChat = 'deepseek-chat',
  DeepseekReasoner = 'deepseek-reasoner',

  // Groq Models
  GroqMetaLlamaLlama4Scout17b16eInstruct = 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
}

@ObjectSchema({
  description: 'LLM Model',
  category: 'LLM',
})
class LLMModel {
  @PortString({
    title: 'Model',
    description: 'Language Model',
  })
  model: LLMModels = LLMModels.Gpt41Mini

  @PortNumber({
    title: 'Temperature',
    description: 'Temperature for sampling',
  })
  temperature: number = 0

  constructor(model: LLMModels, temperature: number) {
    this.model = model
    this.temperature = temperature
  }
}

export const llmModels = {
  // GPT-4.1 Family
  [LLMModels.Gpt41]: new LLMModel(LLMModels.Gpt41, 0),
  [LLMModels.Gpt41Mini]: new LLMModel(LLMModels.Gpt41Mini, 0),
  [LLMModels.Gpt41Nano]: new LLMModel(LLMModels.Gpt41Nano, 0),

  // O-Series Reasoning Models
  [LLMModels.O4Mini]: new LLMModel(LLMModels.O4Mini, 0),
  [LLMModels.O3Pro]: new LLMModel(LLMModels.O3Pro, 0),
  [LLMModels.GptO3Mini]: new LLMModel(LLMModels.GptO3Mini, 0),
  [LLMModels.O3]: new LLMModel(LLMModels.O3, 0),
  [LLMModels.O1]: new LLMModel(LLMModels.O1, 0),
  [LLMModels.O1Mini]: new LLMModel(LLMModels.O1Mini, 0),

  // GPT-4o Family
  [LLMModels.Gpt4oMini]: new LLMModel(LLMModels.Gpt4oMini, 0),
  [LLMModels.Gpt4o]: new LLMModel(LLMModels.Gpt4o, 0),

  // Claude Models
  [LLMModels.ClaudeSonnet4_20250514]: new LLMModel(LLMModels.ClaudeSonnet4_20250514, 0),
  [LLMModels.ClaudeOpus4_20250514]: new LLMModel(LLMModels.ClaudeOpus4_20250514, 0),
  [LLMModels.Claude37Sonnet20250219]: new LLMModel(LLMModels.Claude37Sonnet20250219, 0),
  [LLMModels.Claude35Sonnet20241022]: new LLMModel(LLMModels.Claude35Sonnet20241022, 0),

  // Deepseek Models
  [LLMModels.DeepseekChat]: new LLMModel(LLMModels.DeepseekChat, 0),
  [LLMModels.DeepseekReasoner]: new LLMModel(LLMModels.DeepseekReasoner, 0),

  // Groq Models
  [LLMModels.GroqMetaLlamaLlama4Scout17b16eInstruct]: new LLMModel(LLMModels.GroqMetaLlamaLlama4Scout17b16eInstruct, 0),
}

@Node({
  type: 'LLMCallNode',
  title: 'LLM Call',
  description: 'Sends prompt to Language Model and streams response',
  category: NODE_CATEGORIES.AI,
  tags: ['ai', 'llm', 'prompt', 'gpt'],
})
class LLMCallNode extends BaseNode {
  @Input()
  @PortEnumFromObject(llmModels, {
    title: 'Model',
    description: 'Language Model',
  })
  model: keyof typeof llmModels = LLMModels.Gpt41Mini

  @Input()
  @PortSecret<SupportedProviders>({
    title: 'API Key',
    description: 'LLM provider API Key',
    secretType: 'openai',
    ui: {
      ispassword: true,
    },
  })
  apiKey?: EncryptedSecretValue<SupportedProviders>

  @Input()
  @PortString({
    title: 'Prompt',
    description: 'Input prompt for the language model',
    ui: {
      isTextArea: true,
    },
  })
  prompt: string = ''

  @Input()
  @PortNumber({
    title: 'Temperature',
    description: 'Temperature for sampling',
    min: 0,
    max: 1,
    step: 0.01,
    ui: {
      isSlider: true,
      leftSliderLabel: 'More deterministic',
      rightSliderLabel: 'More creative',
    },
  })
  temperature: number = 0

  @Output()
  @PortStream({
    title: 'Output Stream',
    description: 'Output stream of the Language Model response',
    itemConfig: {
      type: 'string',
      defaultValue: '',
    },
  })
  outputStream: MultiChannel<string> = new MultiChannel<string>()

  async execute(context: ExecutionContext): Promise<NodeExecutionResult> {
    if (!this.apiKey) {
      throw new Error('API Key is required')
    }

    const { apiKey } = await this.apiKey.decrypt(context)

    let llm: ChatDeepSeek | ChatOpenAI | ChatAnthropic

    if (isDeepSeek(this.model)) {
      llm = new ChatDeepSeek({
        apiKey,
        model: this.model,
        // temperature: this.temperature,
        streaming: true,
      })
    } else if (isAnthropic(this.model)) {
      llm = new ChatAnthropic({
        apiKey,
        model: this.model,
        temperature: this.temperature,
        streaming: true,
        thinking: {
          type: 'disabled',
        },
      })
    } else if (isGroq(this.model)) {
      llm = new ChatOpenAI({
        apiKey,
        model: this.model.replace(/^groq\//, ''),
        temperature: this.temperature,
        streaming: true,
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      })
    } else {
      llm = new ChatOpenAI({
        apiKey,
        model: this.model,
        temperature: !isOpenAIThinkingModel(this.model) ? this.temperature : undefined,
        streaming: true,
      })
    }

    const messages = [
      // new SystemMessage(this.prompt),
      new HumanMessage(this.prompt),
    ]

    const stream = await llm.stream(messages, {
      signal: context.abortSignal,
    })

    // Start streaming in the background
    const streamingPromise = async () => {
      try {
        const buffer: string[] = []
        const bufferSize = 1 // TODO: consider if we really need this buffer

        for await (const chunk of stream) {
          // Check if execution was aborted
          if (context.abortSignal.aborted) {
            this.outputStream.close()
            this.outputStream.setError(new Error(`stream aborted`))
            return
          }

          // add chunk to buffer
          if (chunk.content) {
            buffer.push(chunk.content.toString())
          }

          if (buffer.length > bufferSize) {
            // Send chunk content to the output stream
            this.outputStream.send(buffer.join(''))

            // Clear buffer
            buffer.splice(0, buffer.length)
          }
        }

        // Send remaining content
        if (buffer.length > 0) {
          this.outputStream.send(buffer.join(''))
        }
      } catch (error: any) {
        this.outputStream.setError(new Error(error))
        throw error
      } finally {
        // Close the stream in any case
        this.outputStream.close()
      }
    }

    return {
      backgroundActions: [streamingPromise],
    }
  }
}

/**
 * Type alias for supported provider names used in the system.
 */
export type SupportedProviders = 'openai' | 'anthropic' | 'deepseek' | 'groq'

/**
 * Represents an API key type that maps to a secret type defined for supported providers.
 */
export type APIkey = SecretTypeMap[SupportedProviders]['apiKey']

/**
 * Determines whether the given model belongs to the DeepSeek category of models.
 */
export function isDeepSeek(model: LLMModels): boolean {
  return [
    LLMModels.DeepseekReasoner,
    LLMModels.DeepseekChat,
  ].includes(model)
}

/**
 * Determines whether the given model belongs to the Anthropic category of models.
 */
export function isAnthropic(model: LLMModels): boolean {
  return [
    LLMModels.Claude35Sonnet20241022,
    LLMModels.Claude37Sonnet20250219,
    LLMModels.ClaudeSonnet4_20250514,
  ].includes(model)
}

/**
 * Determines whether the given model belongs to the Groq category of models.
 */
export function isGroq(model: LLMModels): boolean {
  return model === LLMModels.GroqMetaLlamaLlama4Scout17b16eInstruct
}

/**
 * Determines whether the given model belongs to the OpenAI category of models.
 */
export function isOpenAI(model: LLMModels): boolean {
  return [
    // GPT-4.1 Family
    LLMModels.Gpt41,
    LLMModels.Gpt41Mini,
    LLMModels.Gpt41Nano,
    // GPT-4o Family
    LLMModels.Gpt4oMini,
    LLMModels.Gpt4o,
    // O-Series Reasoning Models
    LLMModels.O1,
    LLMModels.O1Mini,
    LLMModels.O3,
    LLMModels.GptO3Mini,
    LLMModels.O3Pro,
    LLMModels.O4Mini,
  ].includes(model)
}

/**
 * Determines whether the given model is an OpenAI thinking/reasoning model (O-series).
 */
export function isOpenAIThinkingModel(model: LLMModels): boolean {
  return [
    LLMModels.O1,
    LLMModels.O1Mini,
    LLMModels.O3,
    LLMModels.GptO3Mini,
    LLMModels.O3Pro,
    LLMModels.O4Mini,
  ].includes(model)
}

export default LLMCallNode
