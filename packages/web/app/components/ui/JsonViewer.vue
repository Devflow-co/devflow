<template>
  <div class="json-viewer">
    <template v-for="(item, index) in formattedItems" :key="index">
      <div
        :style="{ paddingLeft: `${item.indent * 12}px` }"
        class="leading-relaxed"
      >
        <span v-if="item.key" class="text-purple-600 dark:text-purple-400">"{{ item.key }}"</span>
        <span v-if="item.key" class="text-gray-500 dark:text-gray-400">: </span>
        <span :class="getValueClass(item.type)">{{ item.displayValue }}</span>
        <span v-if="item.comma" class="text-gray-500 dark:text-gray-400">,</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  data: unknown
}

const props = defineProps<Props>()

interface FormattedItem {
  key?: string
  displayValue: string
  type: 'string' | 'number' | 'boolean' | 'null' | 'bracket'
  indent: number
  comma: boolean
}

const formattedItems = computed(() => {
  const items: FormattedItem[] = []

  const formatValue = (
    value: unknown,
    key: string | undefined,
    indent: number,
    isLast: boolean
  ) => {
    if (value === null) {
      items.push({
        key,
        displayValue: 'null',
        type: 'null',
        indent,
        comma: !isLast
      })
    } else if (typeof value === 'string') {
      items.push({
        key,
        displayValue: `"${value}"`,
        type: 'string',
        indent,
        comma: !isLast
      })
    } else if (typeof value === 'number') {
      items.push({
        key,
        displayValue: String(value),
        type: 'number',
        indent,
        comma: !isLast
      })
    } else if (typeof value === 'boolean') {
      items.push({
        key,
        displayValue: String(value),
        type: 'boolean',
        indent,
        comma: !isLast
      })
    } else if (Array.isArray(value)) {
      items.push({
        key,
        displayValue: '[',
        type: 'bracket',
        indent,
        comma: false
      })
      value.forEach((item, index) => {
        formatValue(item, undefined, indent + 1, index === value.length - 1)
      })
      items.push({
        displayValue: ']',
        type: 'bracket',
        indent,
        comma: !isLast
      })
    } else if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      items.push({
        key,
        displayValue: '{',
        type: 'bracket',
        indent,
        comma: false
      })
      entries.forEach(([k, v], index) => {
        formatValue(v, k, indent + 1, index === entries.length - 1)
      })
      items.push({
        displayValue: '}',
        type: 'bracket',
        indent,
        comma: !isLast
      })
    }
  }

  formatValue(props.data, undefined, 0, true)
  return items
})

const getValueClass = (type: FormattedItem['type']): string => {
  switch (type) {
    case 'string':
      return 'text-green-600 dark:text-green-400'
    case 'number':
      return 'text-blue-600 dark:text-blue-400'
    case 'boolean':
      return 'text-orange-600 dark:text-orange-400'
    case 'null':
      return 'text-gray-500 dark:text-gray-500 italic'
    case 'bracket':
      return 'text-gray-700 dark:text-gray-300'
    default:
      return 'text-gray-700 dark:text-gray-300'
  }
}
</script>
