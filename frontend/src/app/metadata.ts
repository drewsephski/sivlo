import { Metadata } from 'next'
import { brand } from '@/config/brand'

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
}
