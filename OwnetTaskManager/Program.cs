using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Azure.KeyVault;
using Microsoft.Azure.Services.AppAuthentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration.AzureKeyVault;
using OwnetTaskManager.Data;
using OwnetTaskManager.Interfaces;
using OwnetTaskManager.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});


builder.Services.AddScoped<IUserRepository, UserRepository>();

// if (builder.Environment.IsProduction())
// {
//     var keyVaultURL = builder.Configuration.GetSection("KeyVault:keyVaultURL");
//
//     var keyVaultClient =
//         new KeyVaultClient(
//             new KeyVaultClient.AuthenticationCallback(new AzureServiceTokenProvider().KeyVaultTokenCallback));
//
//
//     builder.Configuration.AddAzureKeyVault(keyVaultURL.Value!.ToString(), new DefaultKeyVaultSecretManager());
//
//     var client = new SecretClient(new Uri(keyVaultURL.Value!.ToString()), new DefaultAzureCredential());
//
//     builder.Services.AddDbContext<AppDbContext>(options =>
//         options.UseSqlServer(client.GetSecret("DefaultConnection").Value.Value).ToString());
// }

// if (builder.Environment.IsDevelopment())
// {
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
// }


var app = builder.Build();

// Configure the HTTP request pipeline.
// if (app.Environment.IsDevelopment())
// {
app.UseSwagger();
app.UseSwaggerUI();
// }

app.MapControllers();
app.UseAuthorization();
app.UseHttpsRedirection();

app.Run();