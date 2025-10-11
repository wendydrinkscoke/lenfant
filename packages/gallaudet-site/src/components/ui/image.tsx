import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  fill?: boolean
  priority?: boolean
}

export function Image({
  src,
  alt,
  fill = false,
  priority = false,
  className = '',
  ...rest
}: ImageProps) {
  const loading = priority ? 'eager' : 'lazy'
  const classes = fill
    ? `absolute inset-0 w-full h-full object-cover ${className}`
    : className

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={classes}
      {...rest}
    />
  )
}