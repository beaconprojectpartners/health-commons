import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Section = { heading: string; body: string };
type LegalContent = { updated?: string; sections?: Section[] };

const ALLOWED = new Set(["terms", "privacy", "dua", "conduct"]);

const Legal = () => {
  const { slug = "" } = useParams();
  const [doc, setDoc] = useState<{ title: string; version: string; content: LegalContent } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("legal_documents")
        .select("title, version, content")
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      if (error || !data) setNotFound(true);
      else setDoc({ title: data.title, version: data.version, content: (data.content as LegalContent) ?? {} });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (!ALLOWED.has(slug)) return <Navigate to="/" replace />;

  const sections = doc?.content?.sections ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : notFound || !doc ? (
          <div>
            <h1 className="font-heading text-3xl text-foreground">Document not available</h1>
            <p className="mt-2 text-muted-foreground">This document has not been published yet.</p>
          </div>
        ) : (
          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="font-heading text-4xl text-foreground">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">
              Version {doc.version}
              {doc.content?.updated ? ` · Updated ${doc.content.updated}` : ""}
            </p>
            <div className="mt-8 space-y-8">
              {sections.map((s, i) => (
                <section key={i}>
                  <h2 className="font-heading text-2xl text-foreground">{s.heading}</h2>
                  <p className="mt-2 whitespace-pre-line text-foreground/90">{s.body}</p>
                </section>
              ))}
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Legal;