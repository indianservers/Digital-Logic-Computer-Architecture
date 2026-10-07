import {createElement,type ReactNode} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CourseAuditContext} from './DeviceCourse';

/** Render every tab for content regression tests, bypassing first-visit loading. */
export function renderToStaticMarkup(node:ReactNode){return render(createElement(CourseAuditContext.Provider,{value:true},node));}
