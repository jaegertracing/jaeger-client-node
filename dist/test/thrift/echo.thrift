struct EchoResult {
    1: required string value
}

service Echo  {
    EchoResult echo(
        1: string value
    )
}
