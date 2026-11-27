import { createRoot } from 'react-dom/client';
import { InvoicePage } from '../../src/components/invoice/InvoicePage';
import '../../src/index.css';

const id = (number: number) => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');
const invoiceId = id(1), periodId = id(2), roomId = id(3), serviceId = id(4), buildingId = id(5);
const search = location.search;
const schedule = new URLSearchParams(search).get('view') === 'schedule';
const period = {period_id:periodId, room_id:roomId, room_code:'P101', building_id:buildingId, building_name:'Nhà Nguyễn Trãi',
  customer_name:'Khách thuê kiểm thử', contract_id:id(6), from_date:'2026-11-01', to_date:'2026-12-01', cycle_start:'2026-11-01',
  cycle_end:'2026-12-01', scheduledBillingDate:'2026-11-30', suggestedDueDate:'2026-12-07', scheduleStatus:'DUE', status:'OPEN'};
const rent = {key:'rent',value:{name:'Tiền thuê',amount:2500000,quantity:1,unitPrice:2500000,basis:{billableDays:30,cycleDays:30}}};
const meter = {key:'service:'+serviceId,value:{name:'Điện',amount:null,quantity:null,unitPrice:3500,
  basis:{roomServiceId:serviceId,meterReadingPath:'/api/v1/billing-periods/'+periodId}}};
const calculation = {status:'INCOMPLETE',total:null,subtotal:2500000,lines:[rent,meter],manualLines:[],
  sourceFingerprint:'benchmark',issues:[{code:'MISSING_CHARGE_DATA',source:meter.key,message:'Thiếu chỉ số công tơ của kỳ.'}]};
const invoice = {id:invoiceId, period_id:periodId, room_id:roomId,building_id:buildingId,number:'HDN-001',lifecycle:'DRAFT',
  room_code:period.room_code,building_name:period.building_name,from_date:period.from_date,to_date:period.to_date,
  dueDate:period.suggestedDueDate,version:1,canIssue:false,requiresRecalculation:false,isStale:false,calculation,
  changedSources:[],calculationMessage:'Cần bổ sung chỉ số trước khi phát hành.'};
const original = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.origin).pathname;
  const response = (data: unknown) => Response.json({data, status:200});
  if (path.endsWith('/auth/csrf')) return response({token:'test-csrf',headerName:'X-CSRF-TOKEN'});
  if (path.endsWith('/drafts/schedule')) return response([period]);
  if (path.endsWith('/drafts/periods/' + periodId)) return response(period);
  if (path.endsWith('/drafts/batch/preview')) return response([{periodId,dueDate:period.suggestedDueDate,issues:calculation.issues}]);
  if (path.endsWith('/drafts/batch')) return response({items:[{periodId,invoiceId,status:'NEEDS_ATTENTION'}],counts:{NEEDS_ATTENTION:1}});
  if (path.endsWith('/draft/recalculation')) return response(init?.method === 'POST' ? invoice :
    {version:1,calculation,changes:[],totalDelta:null});
  if (path.endsWith('/invoices/host/' + invoiceId)) return response({invoice,lines:[],payments:[]});
  return original(input, init);
};
createRoot(document.getElementById('root')!).render(<main className="invoice-preview"><InvoicePage accountRole="HOST"
  pathname={schedule ? '/invoices/host' : '/invoices/host/' + invoiceId} search={search}/></main>);
