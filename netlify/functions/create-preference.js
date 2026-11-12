// Netlify Function: cria uma preferência de pagamento sem expor o token.
const catalog = {
  'CAMISETA VICIOUS': {title:'CAMISETA VICIOUS', price:1.00},
  'CAMISETA SCYTHE': {title:'CAMISETA SCYTHE', price:1.00},
  'CAMISETA LEOPARD': {title:'CAMISETA LEOPARD', price:1.00},
};
function findProduct(name){
 const n=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 return Object.values(catalog).find(p=>n.includes(p.title));
}
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:JSON.stringify({error:'Método não permitido'})};
 const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;
 if(!token)return {statusCode:503,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Pagamento ainda não configurado. Adicione MERCADO_PAGO_ACCESS_TOKEN nas variáveis de ambiente do Netlify.'})};
 try{
  if((event.body||'').length>20000)throw new Error('Pedido muito grande.');
  const payload=JSON.parse(event.body||'{}');
  if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>20)throw new Error('Sacola inválida.');
  let totalQty=0;
  const items=payload.items.map(item=>{
   const product=findProduct(item.name),qty=Number(item.qty),size=String(item.size||'').toUpperCase();
   if(!product||!Number.isInteger(qty)||qty<1||qty>10||!['P','M','G','GG','XG'].includes(size))throw new Error('Produto, tamanho ou quantidade inválidos.');
   totalQty+=qty;
   return {title:product.title+' / '+size,quantity:qty,unit_price:product.price,currency_id:'BRL'};
  });
  if(totalQty>20)throw new Error('Quantidade máxima excedida.');
  const site=process.env.URL||'https://badvicious.netlify.app';
  const preference={items,external_reference:'BV-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),back_urls:{success:site,failure:site,pending:site},auto_return:'approved'};
  const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(preference)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.init_point){console.error('Mercado Pago preference error',r.status,JSON.stringify(data).slice(0,1000));return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Mercado Pago não conseguiu preparar o pagamento. Confira as credenciais da conta.'})};}
  return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({checkout_url:data.init_point})};
 }catch(e){return {statusCode:400,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:e.message||'Pedido inválido.'})};}
};
