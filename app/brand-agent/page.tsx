"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, CheckmarkCircle02Icon, LeftTriangleIcon, ArrowRight02Icon } from "@hugeicons/core-free-icons"

export default function BrandAgentPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("http://localhost:5000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error generating asset:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <Badge variant="outline" className="px-4 py-1 text-sm border-indigo-200 text-indigo-700 bg-indigo-50">
            Agentic Workflow Demo
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            BrandStyle Agent
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Generate on-brand marketing assets using our intelligent multi-agent system.
            Try asking for something off-brand to see the <span className="font-semibold text-indigo-600">Style Enforcer</span> in action.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <Card className="lg:col-span-1 h-fit shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle>Creative Brief</CardTitle>
              <CardDescription>Describe the image you need.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="E.g., A moody shot of our product for a winter campaign..."
                className="min-h-[150px] resize-none text-base"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button 
                onClick={handleGenerate} 
                disabled={loading || !prompt}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
              >
                {loading ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Generate Asset"
                )}
              </Button>
              
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">TRY THESE PROMPTS:</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setPrompt("A moody shot of our product for a winter campaign")}
                    className="text-xs text-left w-full p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    ❄️ Winter Campaign (Compliant)
                  </button>
                  <button 
                    onClick={() => setPrompt("A product shot with harsh sunlight and red colors")}
                    className="text-xs text-left w-full p-2 rounded bg-red-50 hover:bg-red-100 text-red-700 transition-colors border border-red-100"
                  >
                    🚫 Harsh Red Light (Non-Compliant)
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {result && (
              <>
                {/* Image Result */}
                <Card className="overflow-hidden shadow-lg border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                     {/* In a real app, this would be the generated image. Since we mock it, we show the placeholder text file content or a visual representation */}
                     <div className="text-center p-8">
                        <img 
                          src="/placeholder-image.png" // You might want to add a real placeholder asset or use the text content
                          alt="Generated Asset" 
                          className="max-h-[400px] mx-auto rounded shadow-2xl opacity-50"
                          onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML += `<div class="text-white text-xl">Image Generated at: ${result.image_url}</div><div class="text-slate-400 text-sm mt-2">(Check local folder for actual file in this demo)</div>`
                          }}
                        />
                     </div>
                  </div>
                  <CardContent className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Generation Successful</h3>
                            <p className="text-slate-500 text-sm">Asset created and logged to audit trail.</p>
                        </div>
                        <Button variant="outline" onClick={() => window.open(result.image_url, '_blank')}>
                            Download Asset
                        </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Agent A: Translator
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-[200px] text-slate-700">
                                {JSON.stringify(result.logs.creative_json, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>

                    <Card className="bg-indigo-50 border-indigo-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                Agent B: Style Enforcer
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <pre className="text-xs bg-white p-3 rounded border border-indigo-200 overflow-auto max-h-[200px] text-slate-700">
                                    {JSON.stringify(result.logs.final_json, null, 2)}
                                </pre>
                                <div className="absolute top-2 right-2">
                                    <Badge className="bg-green-600 hover:bg-green-700">Brand Safe</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
              </>
            )}
            
            {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <HugeiconsIcon icon={ArrowRight02Icon} className="w-8 h-8 text-slate-300" />
                    </div>
                    <p>Enter a prompt to start the workflow</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

