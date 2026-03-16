proc sql;
create table tabla_01 as
select *
from transacciones_diarias
where fecha_contable = today() - 1;

create table tabla_02 as
select a.*,
       case when monto < 0 then 'DEVOLUCION' else 'BOLETA' end as indicador_venta
from tabla_01 a
left join clientes b
  on a.id_cliente = b.id_cliente
where b.activo = 1;

create table tabla_03 as
select *
from tabla_02
where id_cliente in (
    select id_cliente
    from clientes_preferentes
);
quit;

data tabla_04;
merge tabla_03 maestros_producto;
by id_producto;
run;

proc s3;
put tabla_04 s3://mi-bucket/reportes/tabla_04.csv;
run;
