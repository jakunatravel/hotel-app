exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const base = 'https://accounts.zoho.eu';
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  let refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  try {
    const body = JSON.parse(event.body);

    // PASSWORD CHECK — if request includes password, validate and return tokens
    if (body.action === 'login') {
      if (body.password !== process.env.APP_PASSWORD) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid password' })
        };
      }

      // If we have a grant code and no refresh token yet, exchange it
      if (process.env.ZOHO_GRANT_CODE && !refreshToken) {
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: process.env.ZOHO_GRANT_CODE
        });
        const res = await fetch(`${base}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        const data = await res.json();
        if (data.refresh_token) {
          refreshToken = data.refresh_token;
          // Return both so the app can store the refresh token
          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_in: data.expires_in,
              note: 'Save this refresh token as ZOHO_REFRESH_TOKEN in Netlify env vars'
            })
          };
        } else {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Could not exchange grant code', detail: data })
          };
        }
      }

      // Normal login — use refresh token to get access token
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      });
      const res = await fetch(`${base}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    // Legacy: handle direct token calls from old app versions
    const params = new URLSearchParams(body);
    const res = await fetch(`${base}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
