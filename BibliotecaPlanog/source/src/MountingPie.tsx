import {MOUNT_COLORS,MOUNT_STAGES} from './mounting-model';
import type {MountZone} from './mounting-model';
export default function MountingPie({zones}:{zones:MountZone[]}){
 const counts=MOUNT_STAGES.map((_,i)=>zones.filter(z=>z.stage===i).length),total=zones.length;let offset=0;
 const description=counts.map((n,i)=>MOUNT_STAGES[i]+': '+n+' góndolas').join('; ');
 return <figure className="mt-pie"><svg viewBox="0 0 120 120" role="img" aria-label={'Distribución actual: '+(total?description:'sin góndolas')}><circle cx="60" cy="60" r="46" fill="none" stroke="#dce5eb" strokeWidth="19"/>{counts.map((count,i)=>{const length=total?count/total*100:0,start=offset;offset+=length;return count?<circle key={i} cx="60" cy="60" r="46" pathLength="100" fill="none" stroke={MOUNT_COLORS[i]} strokeWidth="19" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"><title>{`${MOUNT_STAGES[i]}: ${count} góndolas (${Math.round(length)}% del total)`}</title></circle>:null;})}<text x="60" y="59" textAnchor="middle" className="mt-pie-total">{total}</text><text x="60" y="74" textAnchor="middle" className="mt-pie-label">góndolas</text></svg><figcaption>Góndolas por estado</figcaption></figure>;
}
