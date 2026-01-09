import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings
    h1: ({ children }) => (
      <h1 className="font-serif text-4xl font-bold tracking-tight mt-12 mb-6 first:mt-0 text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-serif text-3xl font-bold tracking-tight mt-12 mb-4 pb-2 border-b border-border text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-serif text-2xl font-semibold tracking-tight mt-8 mb-3 text-foreground">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="font-serif text-xl font-semibold tracking-tight mt-6 mb-2 text-foreground">
        {children}
      </h4>
    ),

    // Paragraphs and text
    p: ({ children }) => (
      <p className="mb-6 leading-relaxed text-muted-foreground font-sans">
        {children}
      </p>
    ),

    // Links
    a: ({ href, children }) => (
      <Link
        href={href || "#"}
        className="text-primary hover:underline underline-offset-4 font-medium transition-colors"
      >
        {children}
      </Link>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="my-6 ml-6 list-disc space-y-2 text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-6 ml-6 list-decimal space-y-2 text-muted-foreground">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed pl-2">{children}</li>,

    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-primary/50 bg-muted/30 pl-6 py-4 italic text-muted-foreground rounded-r">
        {children}
      </blockquote>
    ),

    // Strong/Bold
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),

    // Code
    code: ({ children, className }) => {
      const isInline = !className;

      if (isInline) {
        return (
          <code className="relative rounded-md bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground border border-border">
            {children}
          </code>
        );
      }

      return <code className={className}>{children}</code>;
    },

    pre: ({ children }) => (
      <pre className="bg-card border border-border text-card-foreground p-6 rounded-lg overflow-x-auto mb-6 font-mono text-sm shadow-sm">
        {children}
      </pre>
    ),

    // Horizontal rule
    hr: () => <hr className="my-8 border-border" />,

    // Table
    table: ({ children }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-border">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-muted-foreground">{children}</td>
    ),

    ...components,
  };
}
