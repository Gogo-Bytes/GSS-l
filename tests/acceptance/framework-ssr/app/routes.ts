import { index, route, type RouteConfig } from '@react-router/dev/routes';
export default [index('routes/home.tsx'),route('details/:id','routes/detail.tsx')] satisfies RouteConfig;
