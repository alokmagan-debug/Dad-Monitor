const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  const store = getStore('dad-monitor-settings');
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // GET - read current settings
  if (event.httpMethod === 'GET') {
    try {
      const settings = await store.get('active-hours', { type: 'json' });
      const defaults = {
        activeStartHour: 23,
        activeStartMinute: 0,
        activeEndHour: 6,
        activeEndMinute: 0,
        updatedAt: null,
      };
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(settings || defaults),
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Could not read settings: ' + e.message }),
      };
    }
  }

  // POST - update settings
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const { activeStartHour, activeStartMinute, activeEndHour, activeEndMinute } = body;

    // Basic validation
    const isValidHour = (h) => Number.isInteger(h) && h >= 0 && h <= 23;
    const isValidMinute = (m) => Number.isInteger(m) && m >= 0 && m <= 59;

    if (
      !isValidHour(activeStartHour) ||
      !isValidMinute(activeStartMinute) ||
      !isValidHour(activeEndHour) ||
      !isValidMinute(activeEndMinute)
    ) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid time values. Hours must be 0-23, minutes 0-59.' }),
      };
    }

    const settings = {
      activeStartHour,
      activeStartMinute,
      activeEndHour,
      activeEndMinute,
      updatedAt: new Date().toISOString(),
    };

    try {
      await store.setJSON('active-hours', settings);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, settings }),
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Could not save settings: ' + e.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
