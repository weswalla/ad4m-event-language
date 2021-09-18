use hdk::prelude::*;
use lazy_static::lazy_static;
use jsonschema_valid::{schemas, Config};
use serde_json::Value;

mod entries;
mod params;

use entries::*;
use params::*;

// TODOs
// - schema json validate entry
//   - field not too big, max length
// - remove assert

entry_defs![
    Expression::entry_def(),
    PrivateExpression::entry_def(),
    PrivateAcaiAgent::entry_def(),
    Path::entry_def()
];

/// Run function when zome is initialized by agent.
/// This adds open cap grant for recv_private_expression function
#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    let mut functions: GrantedFunctions = BTreeSet::new();
    functions.insert((zome_info()?.zome_name, "recv_private_expression".into()));
    
    create_cap_grant(CapGrantEntry {
        tag: "".into(),
        // Empty access converts to unrestricted
        access: ().into(),
        functions,
    })?;

    Ok(InitCallbackResult::Pass)
}

#[hdk_extern]
pub fn create_expression(input: ExpressionInput) -> ExternResult<EntryHash> {
    let ExpressionInput { data, author, timestamp, proof } = input;

    let schema: Value = serde_json::from_str(&EXPRESSION_SCHEMA)
        .map_err(|e| WasmError::Host(e.to_string()))?;
    let cfg = Config::from_schema(&schema, Some(schemas::Draft::Draft7))
        .map_err(|e| WasmError::Host(e.to_string()))?;
    assert!(cfg.validate_schema().is_ok());
    
    let data_json: Value = serde_json::from_str(&data)
        .map_err(|e| WasmError::Host(e.to_string()))?;
    assert!(cfg.validate(&data_json).is_ok());

    let expression = Expression {
        data: data_json,
        author,
        timestamp,
        proof,
    };

    let entry_hash = hash_entry(&expression)?;
    let _header_hash = create_entry(&expression)?;

    hc_time_index::index_entry(expression.author.clone(), expression.clone(), LinkTag::new("expression"))
        .map_err(|e| WasmError::Host(e.to_string()))?;
    
    Ok(entry_hash)
}

#[hdk_extern]
pub fn get_expression_by_author(input: GetByAuthorInput) -> ExternResult<Vec<Expression>> {
    let links = hc_time_index::get_links_for_time_span(
        input.author, input.from, input.until, Some(LinkTag::new("expression")), None
    ).map_err(|e| WasmError::Host(e.to_string()))?;
    debug!("Got links: {:#?}", links);
    links.into_iter()
        .map(|link| {
            let element = get(link.target, GetOptions::default())?
                .ok_or(WasmError::Host(String::from("Could not get entry after commit.")))?;
            let expression = element.entry().to_app_option()?
                .ok_or(WasmError::Host(String::from("Could not deserialize element to expression")))?;
            Ok(expression)
        })
        .collect()
}

#[hdk_extern]
pub fn get_expression_by_address(input: EntryHash) -> ExternResult<Option<Expression>> {
    let optional_element = get(input, GetOptions::default())?;
    if let Some(element) = optional_element {
        let expression: Expression = element.entry()
            .to_app_option()?
            .ok_or(WasmError::Host(String::from("Could not deserialize element into Expression.")))?;
        
        return Ok(Some(expression))
    }

    Ok(None)
}

#[hdk_extern]
pub fn recv_private_expression(input: PrivateExpression) -> ExternResult<EntryHash> {
    let agent = PrivateAcaiAgent(input.author.clone());
    let agent_entry_hash = hash_entry(&agent)?;
    create_entry(&agent)?;
    
    let expression_entry_hash = hash_entry(&input)?;
    create_entry(&input)?;

    create_link(
        agent_entry_hash,
        expression_entry_hash.clone(),
        LinkTag::new("expression"),
    )?;

    Ok(expression_entry_hash)
}

#[hdk_extern]
pub fn send_private_expression(input: PrivateExpressionInput) -> ExternResult<PrivateExpression> {
    let ExpressionInput { data, author, timestamp, proof } = input.expression;

    let schema: Value = serde_json::from_str(&EXPRESSION_SCHEMA)
        .map_err(|e| WasmError::Host(e.to_string()))?;
    let cfg = Config::from_schema(&schema, Some(schemas::Draft::Draft7))
        .map_err(|e| WasmError::Host(e.to_string()))?;
    assert!(cfg.validate_schema().is_ok());
    
    let data_json: Value = serde_json::from_str(&data)
        .map_err(|e| WasmError::Host(e.to_string()))?;
    assert!(cfg.validate(&data_json).is_ok());

    let expression = PrivateExpression {
        data: data_json,
        author,
        timestamp,
        proof,
    };

    // Call the user's remote zome
    // TODO here we want some pattern better than this; only having this succeed when agent is online is not great
    // Here I am sending the identity of the callee of this fn since I dont know if we can get this information in recv_private_expression?
    // Id imagine there is some way but for now this can work fine...
    call_remote(
        input.to,
        ZomeName::from("schema_validation"),
        FunctionName::from("recv_private_expression"),
        None,
        &expression,
    )?;

    Ok(expression)
}

#[derive(SerializedBytes, Serialize, Deserialize, Debug)]
pub struct Properties {
    pub expression_data_schema: String,
}

lazy_static! {
    pub static ref EXPRESSION_SCHEMA: String = {
        let host_dna_config = zome_info()
            .expect("Could not get zome configuration.")
            .properties;
        let properties = Properties::try_from(host_dna_config)
            .expect("Could not convert zome dna properties to Properties.");
        properties.expression_data_schema
    };
}
