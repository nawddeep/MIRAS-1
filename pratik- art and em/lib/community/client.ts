export async function communityRequest<T>(url: string, body?: Record<string,unknown>|FormData, method?: 'GET'|'POST'|'PUT'|'DELETE'): Promise<T> {
  const response=await fetch(url,{method:method ?? (body?'POST':'GET'),cache:'no-store',credentials:'same-origin',...(body?body instanceof FormData?{body}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok || !data.ok)throw new Error(data.error || 'Could not complete this action. Please try again.');return data as T;
}
