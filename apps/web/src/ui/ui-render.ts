import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';

// Test helpers for the presentational layer (imported by tests only).
export function render<P extends object>(component: ComponentType<P>, props: P): string {
  return renderToString(createElement(component, props));
}

/** Visible text only: tags removed. */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}
