export function methodGuard(req: Request, allowed = ['GET', 'POST'] as const) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  
  if (!allowed.includes(req.method as any)) {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      corrId: crypto.randomUUID().slice(0, 8)
    }), { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return null; // proceed
}