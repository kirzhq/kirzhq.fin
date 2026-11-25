import { useEffect, useState } from 'react';
import { api } from '../api';
import { CAR } from '../categories';
import { Icon } from '../components/Icon';
import { ErrorState, Loading, OperationList, PageHead } from '../components/ui';
import { integer, liters, money, moneyRounded } from '../format';
import { errorText, useFinance } from '../store';
import type { Transaction, VehicleSummary } from '../types';

export function Car() {
  const { vehicles, version, openOperation, fail } = useFinance();
  const [year, setYear] = useState(new Date().getFullYear());
  const vehicle = vehicles[0];
  const [summary, setSummary] = useState<VehicleSummary | null>(null);
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehicle) return;
    let stale = false;
    setSummary(null);
    setItems(null);
    Promise.all([api.vehicleSummary(vehicle.id, year), api.transactions({ year, month: null }, undefined, true)])
      .then(([vehicleSummary, transactions]) => {
        if (stale) return;
        setSummary(vehicleSummary);
        setItems(transactions.filter((item) => item.category === CAR));
        setError('');
      })
      .catch((requestError) => { if (!stale) setError(errorText(requestError)); });
    return () => { stale = true; };
  }, [vehicle, year, version]);

  const thisYear = new Date().getFullYear();
  return <>
    <PageHead kicker={vehicle ? `Финансы · ${vehicle.name}` : 'Финансы'} title="Автомобиль">
      <div className="period">
        <button type="button" className="iconbtn" onClick={() => setYear(year - 1)} aria-label="Предыдущий год"><Icon name="left" /></button>
        <b>{year}</b>
        <button type="button" className="iconbtn" disabled={year >= thisYear} onClick={() => setYear(year + 1)} aria-label="Следующий год"><Icon name="right" /></button>
      </div>
      {vehicle && <button type="button" className="btn line" onClick={() => api.exportVehicle(vehicle.id, year).catch(fail)}><Icon name="download" />Excel за {year}</button>}
    </PageHead>
    {!vehicle && <section className="panel empty-panel"><Icon name="car" /><div><b>Автомобиль не добавлен</b><p>В базе нет ни одной машины.</p></div></section>}
    {error && <ErrorState text={error} />}
    {vehicle && !summary && !error && <Loading />}
    {summary && <>
      <section className="panel metrics">
        <div><span>Всего за год</span><b className="num">{money(summary.total)}</b><small>{summary.operationCount} операций</small></div>
        <div><span>Бензин</span><b className="num">{money(summary.fuel)}</b><small>{moneyRounded(summary.averageMonthlyFuel)} в месяц</small></div>
        <div><span>Средний расход</span><b className="num">{summary.fuelConsumptionPer100Km != null ? `${liters(summary.fuelConsumptionPer100Km)} л` : '—'}</b>
          <small>{summary.fuelCostPer100Km != null ? `на 100 км · ${moneyRounded(summary.fuelCostPer100Km)}` : 'нужны пробег и литры'}</small></div>
        <div><span>Пробег</span><b className="num">{summary.mileageKm != null ? `${integer(summary.mileageKm)} км` : '—'}</b>
          <small>{summary.firstOdometerKm != null && summary.latestOdometerKm != null ? `с ${integer(summary.firstOdometerKm)} до ${integer(summary.latestOdometerKm)}` : 'нет отметок одометра'}</small></div>
      </section>
      {summary.latestFuelConsumptionPer100Km != null && <p className="muted small">Последняя заправка: {liters(summary.latestFuelConsumptionPer100Km)} л на 100 км
        {summary.latestFuelCostPer100Km != null ? `, ${moneyRounded(summary.latestFuelCostPer100Km)} за 100 км` : ''}.</p>}
      {!summary.mileageComplete && summary.operationCount > 0 && <div className="note warn"><Icon name="info" /><span>
        {summary.firstOdometerKm == null ? 'Чтобы считать расход на 100 км, укажите пробег хотя бы в двух заправках.'
          : summary.firstOdometerKm === summary.latestOdometerKm ? 'Нужна ещё одна заправка с новым показанием одометра.'
            : 'Есть заправка без пробега или литров, поэтому средний расход может быть неточным.'}
      </span></div>}
    </>}
    {vehicle && <section className="panel">
      <div className="panel-h"><h2>Операции по машине</h2>
        <button type="button" className="btn primary" onClick={() => openOperation({ category: CAR, vehicleExpenseType: 'FUEL' })}><Icon name="plus" />Заправка</button></div>
      {items ? <OperationList items={items} onOpen={(operation) => openOperation({ operation })} dayTotals={false} empty="За этот год расходов на машину нет." /> : !error && <Loading />}
    </section>}
  </>;
}
