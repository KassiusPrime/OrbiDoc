import React, { useEffect, useState } from 'react';
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import { orbiDocDb } from '../../db/orbidocDb';

export interface OrbiDocImagePayload {
  src: string;
  altText?: string;
  caption?: string;
  assetId?: string;
  width?: number;
  height?: number;
}

export type SerializedOrbiDocImageNode = SerializedLexicalNode & {
  type: 'orbidoc-image';
  version: 1;
  src: string;
  altText: string;
  caption: string;
  assetId?: string;
  width?: number;
  height?: number;
};

function ImageDecorator({ payload }: { payload: OrbiDocImagePayload }) {
  const [resolvedSrc, setResolvedSrc] = useState(payload.src);

  useEffect(() => {
    if (!payload.assetId) {
      setResolvedSrc(payload.src);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    void orbiDocDb.assets.get(payload.assetId).then((asset) => {
      if (!active || !asset?.blob) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setResolvedSrc(objectUrl);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload.assetId, payload.src]);

  return (
    <figure className="orbidoc-lexical-image" contentEditable={false}>
      <img
        src={resolvedSrc}
        alt={payload.altText || ''}
        style={{
          width: payload.width ? `${payload.width}px` : 'auto',
          height: payload.height ? `${payload.height}px` : 'auto',
          maxWidth: '100%',
        }}
      />
      {payload.caption ? <figcaption>{payload.caption}</figcaption> : null}
    </figure>
  );
}

function convertImageElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLImageElement)) return null;
  return {
    node: $createOrbiDocImageNode({
      src: domNode.src,
      altText: domNode.alt || '',
      width: domNode.width || undefined,
      height: domNode.height || undefined,
    }),
  };
}

export class OrbiDocImageNode extends DecoratorNode<React.ReactElement> {
  __src: string;
  __altText: string;
  __caption: string;
  __assetId?: string;
  __width?: number;
  __height?: number;

  static getType(): string {
    return 'orbidoc-image';
  }

  static clone(node: OrbiDocImageNode): OrbiDocImageNode {
    return new OrbiDocImageNode(
      {
        src: node.__src,
        altText: node.__altText,
        caption: node.__caption,
        assetId: node.__assetId,
        width: node.__width,
        height: node.__height,
      },
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedOrbiDocImageNode): OrbiDocImageNode {
    return $createOrbiDocImageNode(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({ conversion: convertImageElement, priority: 0 }),
    };
  }

  constructor(payload: OrbiDocImagePayload = { src: '' }, key?: NodeKey) {
    super(key);
    this.__src = payload.src;
    this.__altText = payload.altText || '';
    this.__caption = payload.caption || '';
    this.__assetId = payload.assetId;
    this.__width = payload.width;
    this.__height = payload.height;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'orbidoc-lexical-image-host';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = this.__src;
    image.alt = this.__altText;
    if (this.__width) image.width = this.__width;
    if (this.__height) image.height = this.__height;
    figure.appendChild(image);
    if (this.__caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = this.__caption;
      figure.appendChild(caption);
    }
    return { element: figure };
  }

  exportJSON(): SerializedOrbiDocImageNode {
    return {
      ...super.exportJSON(),
      type: 'orbidoc-image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      caption: this.__caption,
      assetId: this.__assetId,
      width: this.__width,
      height: this.__height,
    };
  }

  decorate(): React.ReactElement {
    return (
      <ImageDecorator
        payload={{
          src: this.__src,
          altText: this.__altText,
          caption: this.__caption,
          assetId: this.__assetId,
          width: this.__width,
          height: this.__height,
        }}
      />
    );
  }
}

export function $createOrbiDocImageNode(payload: OrbiDocImagePayload): OrbiDocImageNode {
  return $applyNodeReplacement(new OrbiDocImageNode(payload));
}

export function $isOrbiDocImageNode(node: LexicalNode | null | undefined): node is OrbiDocImageNode {
  return node instanceof OrbiDocImageNode;
}
