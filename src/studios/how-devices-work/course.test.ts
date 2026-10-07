import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {test,expect} from 'vitest';
import {LABS} from './labs/data';
import {ADVANCED_LABS} from './advanced/data';
import LabPage from './labs/LabPage';
import AdvancedLabPage from './advanced/AdvancedLabPage';
import {renderToStaticMarkup as renderAllTabs} from './test-course-render';
import DeviceExamples from './DeviceExamples';

for(const lab of [...LABS,...ADVANCED_LABS]){
 test(`${lab.number}: seven tabs and no simulator mounted on initial Overview`,()=>{
  const page=lab.number<=54?createElement(LabPage,{lab:lab as typeof LABS[number]}):createElement(AdvancedLabPage,{lab:lab as typeof ADVANCED_LABS[number]});
  const html=renderToStaticMarkup(createElement(MemoryRouter,null,page));
  expect((html.match(/role="tab"/g)??[]).length).toBe(7);
  expect((html.match(/role="tabpanel"/g)??[]).length).toBe(1);
  expect(html).toContain('course-overview-panel');
  expect(html).not.toContain('type="range"');
  expect(html).not.toContain('course-simulation-panel" role="tabpanel"');
  expect(html).not.toContain('course-examples-panel" role="tabpanel"');
  const complete=renderAllTabs(createElement(MemoryRouter,null,page));
  const simulation=complete.indexOf('id="course-simulation-panel"'),applications=complete.indexOf('id="course-applications-panel"');
  for(const input of complete.matchAll(/<input[^>]*type="range"[^>]*>/g)){expect(input.index).toBeGreaterThan(simulation);expect(input.index).toBeLessThan(applications);}
  const physical=complete.slice(complete.indexOf('id="inside-physical-panel"'),complete.indexOf('id="inside-anatomy-panel"'));
  expect(physical).toMatch(/<(img|svg)\b/);

 });
 test(`${lab.number}: independent representative examples produce finite output`,()=>{
  const html=renderToStaticMarkup(createElement(DeviceExamples,{lab}));
  expect(html).toContain('Representative Output Examples');
  expect(html).not.toContain('NaN');
 });
}
