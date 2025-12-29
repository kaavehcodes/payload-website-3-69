import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = pages.docs
    ?.filter((doc) => {
      return doc.slug !== 'home'
    })
    .map(({ slug }) => {
      // Catch-all requires slug as array
      return { slug: [slug] }
    })

  return params
}

type Args = {
  params: Promise<{
    slug?: string[]
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug: slugSegments } = await paramsPromise

  // Handle catch-all: slug is an array of path segments
  // e.g., /post/my-article → ['post', 'my-article']
  // e.g., /about → ['about']
  const slugArray = slugSegments || ['home']
  const fullPath = slugArray.map((segment) => decodeURIComponent(segment)).join('/')
  const url = '/' + fullPath

  // For page lookup, use the last segment (pages have single-segment slugs)
  const pageSlug = slugArray.length === 1 ? decodeURIComponent(slugArray[0]) : null

  let page: RequiredDataFromCollectionSlug<'pages'> | null = null

  // Only look up pages for single-segment URLs
  if (pageSlug) {
    page = await queryPageBySlug({
      slug: pageSlug,
    })

    // Remove this code once your website is seeded
    if (!page && pageSlug === 'home') {
      page = homeStatic
    }
  }

  // For multi-segment URLs or missing pages, check redirects
  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug: slugSegments } = await paramsPromise
  const slugArray = slugSegments || ['home']

  // Only generate metadata for single-segment URLs (pages)
  if (slugArray.length !== 1) {
    return {}
  }

  const decodedSlug = decodeURIComponent(slugArray[0])
  const page = await queryPageBySlug({
    slug: decodedSlug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
