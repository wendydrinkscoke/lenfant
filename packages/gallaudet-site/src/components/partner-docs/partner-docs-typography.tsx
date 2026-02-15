import { Fragment } from "react"

const URL_PATTERN = /(https?:\/\/[^\s]+)/g
const INLINE_CODE_PATTERN = /(`[^`]+`)/g
const SCREENSHOT_PLACEHOLDER_PATTERN = /^<<Insert\s+(?:screenshot|an image|image)\s*:\s*(.+)>>$/i
const SCREENSHOT_ASSET_PATTERN = /^<<Screenshot:\s*(\/[^\s|>]+)\s*\|\s*(.+)>>$/i

const splitUrlAndTrailingPunctuation = (rawUrl: string) => {
  let url = rawUrl
  let trailing = ""

  const countChars = (value: string, char: string) =>
    value.split(char).length - 1

  while (url.length > 0) {
    const lastChar = url[url.length - 1]
    const shouldTrimSimplePunctuation = ".,;:!?\"'".includes(lastChar)

    if (shouldTrimSimplePunctuation) {
      trailing = `${lastChar}${trailing}`
      url = url.slice(0, -1)
      continue
    }

    if (lastChar === ")") {
      const openCount = countChars(url, "(")
      const closeCount = countChars(url, ")")
      if (closeCount > openCount) {
        trailing = `${lastChar}${trailing}`
        url = url.slice(0, -1)
        continue
      }
    }

    if (lastChar === "]") {
      const openCount = countChars(url, "[")
      const closeCount = countChars(url, "]")
      if (closeCount > openCount) {
        trailing = `${lastChar}${trailing}`
        url = url.slice(0, -1)
        continue
      }
    }

    if (lastChar === "}") {
      const openCount = countChars(url, "{")
      const closeCount = countChars(url, "}")
      if (closeCount > openCount) {
        trailing = `${lastChar}${trailing}`
        url = url.slice(0, -1)
        continue
      }
    }

    break
  }

  return { url, trailing }
}

const renderTextWithLinks = (text: string, keyPrefix: string) =>
  text.split(URL_PATTERN).map((segment, index) => {
    if (segment.match(/^https?:\/\/[^\s]+$/)) {
      const { url, trailing } = splitUrlAndTrailingPunctuation(segment)
      return (
        <Fragment key={`${keyPrefix}-link-${index}`}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {url}
          </a>
          {trailing.length > 0 && <span>{trailing}</span>}
        </Fragment>
      )
    }

    return <span key={`${keyPrefix}-text-${index}`}>{segment}</span>
  })

const renderInlineContent = (text: string, keyPrefix: string) =>
  text.split(INLINE_CODE_PATTERN).map((segment, index) => {
    const codeMatch = segment.match(/^`([^`]+)`$/)
    if (codeMatch) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
        >
          {codeMatch[1]}
        </code>
      )
    }

    return (
      <Fragment key={`${keyPrefix}-fragment-${index}`}>
        {renderTextWithLinks(segment, `${keyPrefix}-fragment-${index}`)}
      </Fragment>
    )
  })

const getScreenshotPlaceholderText = (paragraph: string) => {
  const match = paragraph.trim().match(SCREENSHOT_PLACEHOLDER_PATTERN)
  if (!match) {
    return null
  }

  return `Screenshot note: ${match[1]}`
}

const getScreenshotAsset = (paragraph: string) => {
  const match = paragraph.trim().match(SCREENSHOT_ASSET_PATTERN)
  if (!match) {
    return null
  }

  return {
    src: match[1],
    caption: match[2],
  }
}

const isCodeBlock = (paragraph: string) => paragraph.includes("\n")

type PartnerDocsTypographyBodyProps = {
  body: string[]
}

export function PartnerDocsTypographyBody({ body }: PartnerDocsTypographyBodyProps) {
  return (
    <div className="space-y-4">
      {body.map((paragraph, index) => {
        const screenshotAsset = getScreenshotAsset(paragraph)
        if (screenshotAsset) {
          return (
            <figure key={`${paragraph}-${index}`} className="my-6 space-y-2">
              <img
                src={screenshotAsset.src}
                alt={screenshotAsset.caption}
                loading="lazy"
                className="w-full rounded-lg border"
              />
              <figcaption className="text-muted-foreground text-sm">
                {screenshotAsset.caption}
              </figcaption>
            </figure>
          )
        }

        const screenshotNote = getScreenshotPlaceholderText(paragraph)
        if (screenshotNote) {
          return (
            <blockquote
              key={`${paragraph}-${index}`}
              className="mt-6 border-l-2 pl-6 italic text-muted-foreground"
            >
              {screenshotNote}
            </blockquote>
          )
        }

        if (isCodeBlock(paragraph)) {
          return (
            <div key={`${paragraph}-${index}`} className="my-6 w-full overflow-x-auto">
              <pre className="rounded-lg border bg-muted/60 p-4">
                <code className="font-mono text-sm">{paragraph}</code>
              </pre>
            </div>
          )
        }

        return (
          <p key={`${paragraph}-${index}`} className="leading-7 text-foreground/90">
            {renderInlineContent(paragraph, `${index}`)}
          </p>
        )
      })}
    </div>
  )
}
